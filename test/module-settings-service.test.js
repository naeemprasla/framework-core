import test from "node:test";
import assert from "node:assert/strict";
import { ModuleSettingsService } from "../src/core/modules/module-settings-service.js";
import { SecretBox } from "../src/core/security/secret-box.js";
test("module settings validates schema and encrypts secrets",async()=>{
  const calls=[];const db={query:async(sql,args=[])=>{calls.push({sql,args});if(sql.startsWith("SELECT setting_key"))return{rows:[]};return{rows:[]};}};
  const moduleRegistry={get:()=>({settings:[{key:"enabled",label:"Enabled",type:"boolean"},{key:"api_key",label:"API Key",type:"secret"}]})};
  const service=new ModuleSettingsService({database:db,moduleRegistry,secretBox:new SecretBox(Buffer.alloc(32,2))});
  await service.update("app_abcdefgh","custom.crm",{enabled:true,api_key:"secret-value"},"usr_1");
  const inserts=calls.filter(c=>c.sql.startsWith("INSERT INTO core.module_settings"));assert.equal(inserts.length,2);assert.equal(inserts[1].args[3],null);assert.notEqual(inserts[1].args[4],"secret-value");
});
