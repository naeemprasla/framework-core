import test from "node:test";
import assert from "node:assert/strict";
import { ApplicationModuleService } from "../src/core/applications/application-module-service.js";
test("application module middleware enforces per-app enablement",async()=>{const service=new ApplicationModuleService({database:{query:async()=>({rows:[{enabled:false}]})},moduleRegistry:{}});const mw=service.middleware("custom.crm");const req={context:{appId:"app_abcdefgh"}};await assert.rejects(()=>new Promise((resolve,reject)=>mw(req,{},e=>e?reject(e):resolve())),e=>e?.code==="forbidden");});
