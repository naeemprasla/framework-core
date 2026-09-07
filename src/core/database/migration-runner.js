import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { withTransaction } from "./transaction.js";

const MIGRATION_LOCK_KEY = "framework_core_migrations_v1";

export async function runMigrations({ database, directory, logger }) {
  // A session-level advisory lock serializes all framework migration runners.
  // DDL may use other pooled connections, but every framework runner cooperates on this lock.
  const lockClient=await database.connect();
  try {
    await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`,[MIGRATION_LOCK_KEY]);
    await database.query(`CREATE SCHEMA IF NOT EXISTS core`);
    await database.query(`CREATE TABLE IF NOT EXISTS core.schema_migrations (migration_id text PRIMARY KEY, checksum text NOT NULL, executed_at timestamptz NOT NULL DEFAULT now())`);
    const files = (await readdir(directory)).filter(f => f.endsWith(".sql")).sort();
    for (const file of files) {
      const migrationId = file;
      const sql = await readFile(path.join(directory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await database.query(`SELECT checksum FROM core.schema_migrations WHERE migration_id = $1`, [migrationId]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${migrationId}`);
        continue;
      }
      logger.info({ migration_id: migrationId }, "migration_start");
      await withTransaction(database, async client => {
        await client.query(sql);
        await client.query(`INSERT INTO core.schema_migrations (migration_id, checksum) VALUES ($1, $2)`, [migrationId, checksum]);
      });
      logger.info({ migration_id: migrationId }, "migration_complete");
    }
  } finally {
    try { await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`,[MIGRATION_LOCK_KEY]); }
    finally { lockClient.release(); }
  }
}
