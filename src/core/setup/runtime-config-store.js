import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "var/config/runtime.enc.json");
const DEFAULT_KEY_PATH = resolve(process.cwd(), "var/secrets/runtime.key");

function ensurePrivateParent(path) {
  mkdirSync(dirname(path), { recursive:true, mode:0o700 });
  try { chmodSync(dirname(path), 0o700); } catch {}
}

function readOrCreateKey(keyPath = DEFAULT_KEY_PATH) {
  ensurePrivateParent(keyPath);
  if (!existsSync(keyPath)) {
    writeFileSync(keyPath, randomBytes(32), { mode:0o600, flag:"wx" });
  }
  const key = readFileSync(keyPath);
  if (key.length !== 32) throw new Error("Invalid runtime encryption key");
  return key;
}

export class RuntimeConfigStore {
  constructor({ configPath = DEFAULT_CONFIG_PATH, keyPath = DEFAULT_KEY_PATH } = {}) {
    this.configPath = configPath;
    this.keyPath = keyPath;
  }
  exists() { return existsSync(this.configPath); }
  save(values) {
    const key = readOrCreateKey(this.keyPath);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(values), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const payload = { version:1, algorithm:"aes-256-gcm", iv:iv.toString("base64url"), tag:cipher.getAuthTag().toString("base64url"), ciphertext:ciphertext.toString("base64url") };
    ensurePrivateParent(this.configPath);
    writeFileSync(this.configPath, JSON.stringify(payload, null, 2), { mode:0o600 });
    try { chmodSync(this.configPath, 0o600); } catch {}
    return true;
  }
  load() {
    if (!this.exists()) return {};
    const payload = JSON.parse(readFileSync(this.configPath, "utf8"));
    if (payload.version !== 1 || payload.algorithm !== "aes-256-gcm") throw new Error("Unsupported runtime configuration format");
    const key = readOrCreateKey(this.keyPath);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64url")), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  }
  key() { return readOrCreateKey(this.keyPath); }
}
