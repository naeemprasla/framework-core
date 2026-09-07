import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSupabaseDirectUrl, createSupabaseDirectUrl } from "../src/core/setup/database-connection-policy.js";

test("Supabase direct connection enforces direct host, port 5432 and SSL",()=>{
  const url=new URL(normalizeSupabaseDirectUrl("postgresql://postgres:secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres"));
  assert.equal(url.hostname,"db.abcdefghijklmnopqrst.supabase.co");
  assert.equal(url.port,"5432");
  assert.equal(url.searchParams.get("sslmode"),"require");
});

test("Supabase direct mode rejects Supavisor and transaction pooler URLs",()=>{
  assert.throws(()=>normalizeSupabaseDirectUrl("postgres://postgres.project:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres"),/Direct Connection/);
  assert.throws(()=>normalizeSupabaseDirectUrl("postgres://postgres:secret@db.abcdefghijklmnopqrst.supabase.co:6543/postgres"),/Direct Connection/);
});

test("Supabase direct URL can be built from project reference",()=>{
  const url=new URL(createSupabaseDirectUrl({project_ref:"abcdefghijklmnopqrst",password:"secret"}));
  assert.equal(url.hostname,"db.abcdefghijklmnopqrst.supabase.co");
  assert.equal(url.username,"postgres");
  assert.equal(url.pathname,"/postgres");
  assert.equal(url.searchParams.get("sslmode"),"require");
});
