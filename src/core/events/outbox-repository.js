export class OutboxRepository {
  constructor(db) { this.db = db; }
  async append(event, client = this.db) {
    await client.query(`INSERT INTO infrastructure.outbox_events(event_id,event_type,event_version,payload,status,created_at,next_attempt_at) VALUES($1,$2,$3,$4,'pending',now(),now()) ON CONFLICT(event_id) DO NOTHING`, [event.id,event.type,event.version,JSON.stringify(event)]);
  }
  async claim(limit = 100) {
    const { rows } = await this.db.query(`WITH picked AS (
      SELECT event_id FROM infrastructure.outbox_events
      WHERE status='pending' AND COALESCE(next_attempt_at,created_at)<=now()
      ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    UPDATE infrastructure.outbox_events e SET status='processing',attempts=e.attempts+1
    FROM picked WHERE e.event_id=picked.event_id RETURNING e.*`, [limit]);
    return rows;
  }
  async markPublished(id) { await this.db.query(`UPDATE infrastructure.outbox_events SET status='published',published_at=now(),last_error=NULL WHERE event_id=$1`, [id]); }
  async markFailed(id, error, attempts) {
    const terminal = Number(attempts) >= 10;
    const delaySeconds = Math.min(300, Math.max(1, 2 ** Math.min(Number(attempts), 8)));
    await this.db.query(`UPDATE infrastructure.outbox_events SET status=$2,next_attempt_at=CASE WHEN $2='pending' THEN now()+($3::int * interval '1 second') ELSE next_attempt_at END,last_error=$4 WHERE event_id=$1`, [id, terminal ? 'failed' : 'pending', delaySeconds, String(error?.message ?? error).slice(0,2000)]);
  }
}
