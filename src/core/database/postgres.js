import pg from "pg";
const { Pool } = pg;
export class PostgresDatabase {
  constructor({ connectionString, max = 20, statementTimeoutMs = 5000, idleTimeoutMs = 30000, connectionTimeoutMs = 5000, logger }) {
    this.logger = logger;
    this.pool = new Pool({ connectionString, max, statement_timeout:statementTimeoutMs, idleTimeoutMillis:idleTimeoutMs, connectionTimeoutMillis:connectionTimeoutMs, application_name:"framework-core", allowExitOnIdle:false });
    this.pool.on("error", err => this.logger.error({ err }, "postgres_pool_error"));
  }
  async query(text, values = []) {
    const started = performance.now();
    try { return await this.pool.query(text, values); }
    finally { const durationMs = performance.now() - started; if (durationMs > 250) this.logger.warn({ duration_ms:Math.round(durationMs), query_name:inferQueryName(text) }, "slow_query"); }
  }
  async connect() { return this.pool.connect(); }
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tx = Object.freeze({ query:(...args) => client.query(...args) });
      const result = await fn(tx);
      await client.query("COMMIT"); return result;
    } catch (err) { try { await client.query("ROLLBACK"); } catch (rollbackError) { this.logger.error({ err:rollbackError }, "transaction_rollback_failed"); } throw err; }
    finally { client.release(); }
  }
  async ping() { await this.query("SELECT 1"); return true; }
  async close() { await this.pool.end(); }
}
function inferQueryName(text) { return String(text).trim().replace(/\s+/g, " ").split(" ").slice(0, 3).join(" ").slice(0, 80); }
