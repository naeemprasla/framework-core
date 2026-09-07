import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RuntimeConfigStore } from "../src/core/setup/runtime-config-store.js";
import { SetupTokenManager } from "../src/core/setup/setup-token-manager.js";
import { TotpService } from "../src/core/security/totp-service.js";
import { SecretBox } from "../src/core/security/secret-box.js";

test("runtime configuration is encrypted at rest and round-trips",()=>{const d=mkdtempSync(join(tmpdir(),"fwcfg-"));const store=new RuntimeConfigStore({configPath:join(d,"config/runtime.enc.json"),keyPath:join(d,"secrets/runtime.key")});store.save({DATABASE_URL:"postgresql://secret@db/framework",AUTH_TOKEN_PEPPER:"x".repeat(48)});const raw=readFileSync(store.configPath,"utf8");assert.equal(raw.includes("postgresql://secret"),false);assert.equal(store.load().DATABASE_URL,"postgresql://secret@db/framework");assert.equal(statSync(store.keyPath).mode & 0o777,0o600);});
test("one-time setup token cannot be exchanged twice",()=>{const m=new SetupTokenManager({ttlMs:10000});const token=m.plain;const session=m.exchange(token);assert.ok(session);assert.equal(m.exchange(token),null);assert.equal(m.validateSession(session),true);m.invalidate();assert.equal(m.validateSession(session),false);});
test("TOTP verifies RFC-compatible time code",()=>{const t=new TotpService();const secret="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";assert.equal(t.verify({secret,code:"287082",now:59000,window:0}),true);assert.equal(t.verify({secret,code:"000000",now:59000,window:0}),false);assert.ok(t.uri({secret,account:"admin@example.com"}).startsWith("otpauth://totp/"));});
test("secret box authenticates ciphertext",()=>{const box=new SecretBox(Buffer.alloc(32,9));const encrypted=box.encrypt("TOP-SECRET");assert.equal(box.decrypt(encrypted),"TOP-SECRET");const parts=encrypted.split(".");const payload=Buffer.from(parts[3],"base64url");payload[0]^=1;parts[3]=payload.toString("base64url");assert.throws(()=>box.decrypt(parts.join(".")));});
