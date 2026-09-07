import test from "node:test";
import assert from "node:assert/strict";
import { HealthRegistry } from "../src/core/health/health-registry.js";
test("critical health checks time out and fail readiness",async()=>{
  const h=new HealthRegistry();h.register("hung",()=>new Promise(()=>{}),{critical:true,timeoutMs:10});const r=await h.run();assert.equal(r.status,"not_ready");assert.equal(r.checks.hung.status,"down");
});
