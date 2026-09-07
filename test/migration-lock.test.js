import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "../src/core/database/migration-runner.js";

test("migration runner acquires and releases a PostgreSQL advisory lock",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"fw-mig-"));writeFileSync(join(dir,"001.sql"),"SELECT 1;");
  const calls=[];
  const lockClient={query:async(sql,args)=>{calls.push([sql,args]);return{rows:[]}},release:()=>calls.push(["release"])};
  const txClient={query:async()=>({rows:[]})};
  const db={connect:async()=>lockClient,query:async(sql)=>sql.includes("SELECT checksum")?{rowCount:1,rows:[{checksum:(await import("node:crypto")).createHash("sha256").update("SELECT 1;").digest("hex") }]}:{rowCount:0,rows:[]}};
  // Existing migration path avoids needing a second transaction connection.
  await runMigrations({database:db,directory:dir,logger:{info(){}}});
  assert.match(calls[0][0],/pg_advisory_lock/);
  assert.match(calls.at(-2)[0],/pg_advisory_unlock/);
  assert.equal(calls.at(-1)[0],"release");
});
