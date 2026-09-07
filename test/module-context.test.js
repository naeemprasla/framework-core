import test from "node:test";
import assert from "node:assert/strict";
import { createModuleContext } from "../src/core/modules/module-context.js";
import { CapabilityRegistry } from "../src/core/capabilities/capability-registry.js";

function kernel(){
  const capabilities=new CapabilityRegistry();
  return {capabilities,routes:{register:x=>x},health:{register:()=>{}},services:{has:()=>false},logger:{child:()=>({})}};
}
test("module context enforces declared capability provides/dependencies",()=>{
  const k=kernel(); const rec={id:"acme.test",name:"T",version:"1.0.0",provides:["test.provide"],dependencies:{required:["core.dep"],optional:[]},events:{publish:[],subscribe:[]},jobs:[]};
  k.capabilities.register("core.dep",{}, {owner:"core"});
  const ctx=createModuleContext(k,rec);
  assert.doesNotThrow(()=>ctx.capabilities.register("test.provide",{}));
  assert.throws(()=>ctx.capabilities.register("other.cap",{}));
  assert.doesNotThrow(()=>ctx.capabilities.require("core.dep"));
  assert.throws(()=>ctx.capabilities.require("secret.cap"));
});

test("module context exposes namespaced Admin UI registration only",()=>{
  const registered=[];
  const kernel={capabilities:{has(){return false;}},services:{has:n=>n==="core.adminUi",resolve:()=>({registerForModule(moduleId,entry){registered.push({moduleId,entry});return entry;}})},health:{register(){}},routes:{register(){}},logger:{child(){return this;}}};
  const ctx=createModuleContext(kernel,{id:"billing",name:"Billing",version:"1.0.0",dependencies:{required:[],optional:[]},provides:[],jobs:[],events:{publish:[],subscribe:[]}});
  ctx.admin.registerPage({id:"billing.dashboard",label:"Billing",href:"/admin/modules/billing"});
  assert.equal(registered[0].moduleId,"billing");
});
