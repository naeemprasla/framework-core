import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/core/config/env.js";
import { createLogger } from "../src/core/observability/logger.js";
import { PostgresDatabase } from "../src/core/database/postgres.js";
import { runMigrations } from "../src/core/database/migration-runner.js";

const config = loadConfig();
const logger = createLogger({ level: config.log.level, env: config.env });
const database = new PostgresDatabase({ connectionString: config.database.url, max: 2, statementTimeoutMs: config.database.statementTimeoutMs, logger });
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  await runMigrations({ database, directory: path.resolve(here, "../src/core/database/migrations"), logger });
  logger.info("migrations_complete");
} finally { await database.close(); }
