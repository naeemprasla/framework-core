import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function text(path){
  return readFile(new URL(path, root), "utf8");
}

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

test("setup route canonicalizes trailing slash before relative assets", async()=>{
  const source = await text("src/setup-console/create-setup-app.js");
  assert.match(source, /app\.get\("\/setup".*redirect\(308,"\/setup\/"\)/s);
  assert.match(source, /text\/css/);
});
