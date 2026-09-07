import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSessionAuthenticationMiddleware, createSameOriginMiddleware } from "../src/core/auth/auth-middleware.js";

function run(mw,req){return new Promise((resolve,reject)=>mw(req,{},err=>err?reject(err):resolve()));}

test("admin cookie middleware authenticates HttpOnly-session token source",async()=>{
  const auth={authenticate:async token=>token==="secret-token"?{account_id:"usr_1",session_id:"ses_1"}:null};
  const req={context:{},get(name){return name.toLowerCase()==="cookie"?"x=1; framework_admin_session=secret-token":"";}};
  await run(createAdminSessionAuthenticationMiddleware({auth}),req);
  assert.equal(req.context.accountId,"usr_1");
});

test("same-origin middleware rejects foreign Origin and cross-site fetch",async()=>{
  const mw=createSameOriginMiddleware({baseUrl:"https://framework.example"});
  await assert.rejects(()=>run(mw,{get:n=>n.toLowerCase()==="origin"?"https://evil.example":n.toLowerCase()==="sec-fetch-site"?"cross-site":""}));
  await run(mw,{get:n=>n.toLowerCase()==="origin"?"https://framework.example":n.toLowerCase()==="sec-fetch-site"?"same-origin":""});
});
