import test from "node:test";
import assert from "node:assert/strict";
import { AdminUiRegistry } from "../src/core/admin-ui/admin-ui-registry.js";

test("admin UI registry enforces namespaced module contributions and /admin routes",()=>{
  const registry=new AdminUiRegistry();
  registry.register({id:"core.overview",label:"Overview",href:"/admin/overview",area:"overview"});
  assert.equal(registry.list()[0].id,"core.overview");
  assert.throws(()=>registry.registerForModule("billing",{id:"other.page",label:"Bad",href:"/admin/bad"}));
  assert.throws(()=>registry.register({id:"evil.page",label:"Bad",href:"https://evil.example",area:"extensions"}));
  registry.registerForModule("billing",{id:"billing.dashboard",label:"Billing",href:"/admin/modules/billing",area:"extensions"});
  assert.equal(registry.list().length,2);
});
