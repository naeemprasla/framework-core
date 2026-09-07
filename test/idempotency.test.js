import test from "node:test";
import assert from "node:assert/strict";
import { IdempotencyService } from "../src/core/idempotency/idempotency-service.js";
class MemoryCache {
  constructor(){this.m=new Map();}
  async get(k){return this.m.get(k)??null;} async set(k,v){this.m.set(k,v);} async delete(k){this.m.delete(k);} async setIfAbsent(k,v){if(this.m.has(k))return false;this.m.set(k,v);return true;}
}
test("idempotency replays same result and rejects payload mismatch", async()=>{
  const service=new IdempotencyService({cache:new MemoryCache()}); let calls=0;
  const a=await service.execute("abcdefgh",async()=>({n:++calls}),{scope:"x",request:{a:1}});
  const b=await service.execute("abcdefgh",async()=>({n:++calls}),{scope:"x",request:{a:1}});
  assert.deepEqual(a,b); assert.equal(calls,1);
  await assert.rejects(()=>service.execute("abcdefgh",async()=>({}),{scope:"x",request:{a:2}}), e=>e.status===409);
});
