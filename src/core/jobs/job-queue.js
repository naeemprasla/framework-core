import { newId } from "../ids/id.js";

export class JobQueue {
  constructor({ registry, database, logger, pollIntervalMs = 250, workerId = newId("wrk") }) {
    Object.assign(this, { registry, database, logger, pollIntervalMs, workerId });
    this.running = false; this.timer = null; this.inFlight = false;
  }
  async enqueue(jobId, payload = {}, options = {}) {
    const def = this.registry.get(jobId);
    const id = newId("job");
    const maxAttempts = options.maxAttempts ?? def.retries ?? 3;
    const delayMs = Math.max(0, Number(options.delayMs ?? 0));
    await this.database.query(`INSERT INTO infrastructure.jobs(job_id,job_type,payload,status,attempts,max_attempts,available_at,created_at) VALUES($1,$2,$3,'pending',0,$4,now()+($5::bigint * interval '1 millisecond'),now())`, [id, jobId, JSON.stringify(payload), maxAttempts, delayMs]);
    return { id, jobId, payload, maxAttempts };
  }
  start() {
    if (this.running) return;
    this.running = true;
    const tick = async () => {
      if (!this.running || this.inFlight) return;
      this.inFlight = true;
      try { await this.drainOnce(); } catch (err) { this.logger?.error({ err }, "job_worker_tick_failed"); }
      finally { this.inFlight = false; }
    };
    this.timer = setInterval(tick, this.pollIntervalMs); this.timer.unref?.(); queueMicrotask(tick);
  }
  async claim(limit = 10) {
    const { rows } = await this.database.query(`WITH picked AS (
      SELECT job_id FROM infrastructure.jobs
      WHERE status='pending' AND available_at<=now()
      ORDER BY available_at, created_at
      LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    UPDATE infrastructure.jobs j SET status='processing', locked_at=now(), locked_by=$2, attempts=j.attempts+1
    FROM picked WHERE j.job_id=picked.job_id RETURNING j.*`, [limit, this.workerId]);
    return rows;
  }
  async drainOnce() {
    const records = await this.claim(10);
    for (const record of records) await this.execute(record);
    return records.length;
  }
  async execute(record) {
    let def;
    try { def = this.registry.get(record.job_type); }
    catch (err) { await this.fail(record, err, false); return; }
    const timeoutMs = def.timeoutMs ?? 60000;
    let timer;
    try {
      await Promise.race([
        Promise.resolve(def.handler(record.payload, { job:record })),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Job timed out after ${timeoutMs}ms`)), timeoutMs); timer.unref?.(); })
      ]);
      await this.database.query(`UPDATE infrastructure.jobs SET status='completed',completed_at=now(),locked_at=NULL,locked_by=NULL WHERE job_id=$1`, [record.job_id]);
    } catch (err) {
      const retry = Number(record.attempts) < Number(record.max_attempts);
      await this.fail(record, err, retry);
    } finally { if (timer) clearTimeout(timer); }
  }
  async fail(record, err, retry) {
    const message = String(err?.message ?? err).slice(0, 2000);
    if (retry) {
      const delaySeconds = Math.min(300, Math.max(1, 2 ** Math.min(Number(record.attempts), 8)));
      await this.database.query(`UPDATE infrastructure.jobs SET status='pending',available_at=now()+($2::int * interval '1 second'),locked_at=NULL,locked_by=NULL,last_error=$3 WHERE job_id=$1`, [record.job_id, delaySeconds, message]);
    } else {
      await this.database.query(`UPDATE infrastructure.jobs SET status='failed',failed_at=now(),locked_at=NULL,locked_by=NULL,last_error=$2 WHERE job_id=$1`, [record.job_id, message]);
      this.logger?.error({ job_id:record.job_id, job_type:record.job_type, err }, "job_failed");
    }
  }
  async close() { this.running = false; if (this.timer) clearInterval(this.timer); this.timer = null; while (this.inFlight) await new Promise(r => setTimeout(r, 10)); }
}
