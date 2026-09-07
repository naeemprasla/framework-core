import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FRAMEWORK_VERSION } from "../src/core/version.js";

const root=new URL("../",import.meta.url);
const text=path=>readFile(new URL(path,root),"utf8");

test("package, runtime and installer use one framework version source",async()=>{
  const pkg=JSON.parse(await text("package.json"));
  const bootstrap=await text("src/bootstrap/bootstrap-core.js");
  const index=await text("src/index.js");
  assert.equal(pkg.version,FRAMEWORK_VERSION);
  assert.match(bootstrap,/FRAMEWORK_VERSION/);
  assert.match(index,/FRAMEWORK_VERSION/);
  assert.doesNotMatch(bootstrap,/const FRAMEWORK_VERSION\s*=\s*["']/);
});

test("audited installer persists admin profile and makes initial application retry-safe",async()=>{
  const migration=await text("src/core/database/migrations/008_audit_release_hardening.sql");
  const repo=await text("src/core/setup/framework-setup-repository.js");
  assert.match(migration,/framework_admin_profiles/);
  assert.match(migration,/initial_application_id/);
  assert.match(repo,/INSERT INTO identity\.framework_admin_profiles/);
  assert.match(repo,/initial_application_id/);
  assert.match(repo,/FOR UPDATE/);
});

test("admin console has one canonical router mount and setup redirects to login route",async()=>{
  const app=await text("src/app/create-app.js");
  const setup=await text("src/setup-console/assets/setup.js");
  assert.match(app,/app\.get\("\/admin".*redirect\(308,"\/admin\/"\)/s);
  assert.equal((app.match(/createAdminConsoleRouter\(\)/g)||[]).length,1);
  assert.match(setup,/location\.href='\/admin\/login'/);
});
