import test from "node:test";
import assert from "node:assert/strict";
import { requiresInstaller } from "../src/core/config/install-mode.js";
import { LocalCache } from "../src/core/cache/local-cache.js";

test("PostgreSQL alone is sufficient to leave installer mode",()=>{
  assert.equal(requiresInstaller({databaseUrl:"postgresql://user:pass@db/framework"}),false);
});

test("missing PostgreSQL keeps framework in installer mode regardless of Redis",()=>{
  assert.equal(requiresInstaller({databaseUrl:null,redisUrl:"redis://cache:6379"}),true);
});

test("local cache implements the cache contract used without Redis",async()=>{
  const cache=new LocalCache();
  await cache.connect();
  assert.equal(await cache.ping(),true);
  assert.equal(await cache.get("missing"),null);
  await cache.set("feature",{enabled:true},{ttlSeconds:60});
  assert.deepEqual(await cache.get("feature"),{enabled:true});
  assert.equal(await cache.setIfAbsent("lock","a",{ttlSeconds:30}),true);
  assert.equal(await cache.setIfAbsent("lock","b",{ttlSeconds:30}),false);
  assert.equal(await cache.increment("count",{ttlSeconds:30}),1);
  assert.equal(await cache.increment("count",{ttlSeconds:30}),2);
  await cache.delete("feature");
  assert.equal(await cache.get("feature"),null);
  await cache.close();
});
