import test from "node:test";
import assert from "node:assert/strict";
import { createApplicationContextMiddleware } from "../src/core/applications/application-context-middleware.js";
function run(mw,req){return new Promise((resolve,reject)=>mw(req,{},err=>err?reject(err):resolve()));}
test("headless request resolves application and service credential",async()=>{
  const req={path:"/v1/custom/orders",context:{},get:n=>({"x-application-id":"app_abcdefgh","authorization":"Bearer fwa_secret"}[n.toLowerCase()]||null)};
  const mw=createApplicationContextMiddleware({applications:{findById:async()=>({app_id:"app_abcdefgh",status:"ACTIVE",api_enabled:true,delivery_mode:"headless",cors_allowed_origins:["https://web.example"]})},appConfig:{authenticateApiKey:async()=>({credential_id:"key_1",scopes:["orders.read"]})}});
  await run(mw,req);assert.equal(req.context.appId,"app_abcdefgh");assert.equal(req.context.identity.authority_domain,"service");assert.deepEqual(req.context.identity.scopes,["orders.read"]);
});
test("disabled application API rejects headless request",async()=>{
  const req={path:"/v1/custom/orders",context:{},get:n=>n.toLowerCase()==="x-application-id"?"app_abcdefgh":null};
  const mw=createApplicationContextMiddleware({applications:{findById:async()=>({app_id:"app_abcdefgh",status:"ACTIVE",api_enabled:false})}});
  await assert.rejects(()=>run(mw,req),e=>e?.code==="forbidden");
});
