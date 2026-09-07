import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SetupTokenManager } from "../src/core/setup/setup-token-manager.js";

const root = new URL("../", import.meta.url);
async function text(path){ return readFile(new URL(path, root), "utf8"); }

test("setup console uses route-relative assets", async()=>{
  const html = await text("src/setup-console/index.html");
  assert.match(html, /href="\.\/assets\/setup\.css"/);
  assert.match(html, /src="\.\/assets\/setup\.js"/);
  assert.doesNotMatch(html, /href="\/setup\/assets\/setup\.css"/);
});

test("admin console uses route-relative assets", async()=>{
  const html = await text("src/admin-console/index.html");
  assert.match(html, /href="\.\/assets\/admin\.css"/);
  assert.match(html, /src="\.\/assets\/admin\.js"/);
  assert.doesNotMatch(html, /href="\/admin\/assets\/admin\.css"/);
});

test("setup canonical route preserves tokenized query and generated URL already has trailing slash", async()=>{
  const source = await text("src/setup-console/create-setup-app.js");
  assert.match(source, /originalUrl\.includes\("\?"\)/);
  assert.match(source, /res\.redirect\(308,`\/setup\/\$\{query\}`\)/);
  assert.match(source, /text\/css/);
  const manager=new SetupTokenManager();
  const url=manager.url("http://localhost:3000");
  assert.match(url,/^http:\/\/localhost:3000\/setup\/\?token=/);
});
