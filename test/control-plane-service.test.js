import test from "node:test";
import assert from "node:assert/strict";
import { ControlPlaneService } from "../src/core/admin-ui/control-plane-service.js";

class DB { async query(sql){
  if(sql.includes("FROM core.applications a")) return {rows:[{app_id:"app_1",name:"App",status:"ACTIVE",tenant_count:2,enabled_module_count:4}]};
  if(sql.includes("AS applications")) return {rows:[{applications:"1",tenants:"2",active_sessions:"3"}]};
  if(sql.includes("FROM infrastructure.jobs GROUP BY")) return {rows:[{status:"pending",count:2}]};
  if(sql.includes("FROM infrastructure.outbox_events GROUP BY")) return {rows:[{status:"published",count:5}]};
  if(sql.includes("FROM audit.events")) return {rows:[]};
  return {rows:[]};
}}

test("control plane overview returns aggregate safe operational data",async()=>{
  const service=new ControlPlaneService({database:new DB(),health:{run:async()=>({status:"ready",checks:{postgres:{status:"healthy"}}})},moduleRegistry:{list:()=>[{id:"users",impl:{secret:true},manifestPath:"/private"}]},themes:{themes:new Map()},adminUi:{list:()=>[]},frameworkVersion:"0.4.0"});
  const data=await service.overview();
  assert.equal(data.counts.applications,1);assert.equal(data.counts.modules,1);assert.equal(data.framework.version,"0.4.0");
  const modules=service.modules();
  assert.equal("impl" in modules[0],false);assert.equal("manifestPath" in modules[0],false);
});
