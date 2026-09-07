const ISOLATION_LEVELS = new Set(["READ COMMITTED","REPEATABLE READ","SERIALIZABLE"]);
export async function withTransaction(database, fn, { isolationLevel = null } = {}) {
  if (isolationLevel && !ISOLATION_LEVELS.has(isolationLevel)) throw new TypeError("Unsupported transaction isolation level");
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    if (isolationLevel) await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    const result = await fn(client);
    await client.query("COMMIT"); return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally { client.release(); }
}
