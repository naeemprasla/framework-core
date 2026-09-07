import test from "node:test";
import assert from "node:assert/strict";
import { withTransaction } from "../src/core/database/transaction.js";
test("transaction isolation is whitelisted",async()=>{
  await assert.rejects(()=>withTransaction({connect(){throw new Error("should not connect");}},async()=>{}, {isolationLevel:"READ COMMITTED; DROP TABLE x"}),TypeError);
});
