import test from "node:test";
import assert from "node:assert/strict";
import { LocalStorage } from "../src/core/storage/local-storage.js";
import { TemplateEngine } from "../src/core/themes/template-engine.js";
import { TokenService } from "../src/core/security/token-service.js";
import { PasswordHasher } from "../src/core/security/password-hasher.js";

const storage = new LocalStorage({ root:"/tmp/framework-storage-test" });
test("local storage rejects traversal and prefix escapes", () => {
  assert.throws(() => storage.path("../framework-storage-test-evil/file"));
  assert.throws(() => storage.path("../outside/file"));
  assert.doesNotThrow(() => storage.path("tenant/file.txt"));
});

test("template engine escapes HTML and rejects expressions", () => {
  const engine = new TemplateEngine();
  assert.equal(engine.render("Hi {{ user.name }}", { user:{ name:"<b>x</b>" } }), "Hi &lt;b&gt;x&lt;/b&gt;");
  assert.throws(() => engine.render("{{ user.constructor() }}", { user:{} }));
});

test("token hashes use pepper when supplied", () => {
  const a = new TokenService({ pepper:"a".repeat(32) });
  const b = new TokenService({ pepper:"b".repeat(32) });
  assert.notEqual(a.hash("token-value"), b.hash("token-value"));
});

test("password hasher rejects malicious parameter inflation", async () => {
  const hasher = new PasswordHasher();
  assert.equal(await hasher.verify("scrypt$999999999$8$1$AA$AA", "password"), false);
});
