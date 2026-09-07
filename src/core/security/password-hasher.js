import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCb);

const DEFAULT = Object.freeze({ N: 32768, r: 8, p: 1, keyLength: 64, maxmem: 64 * 1024 * 1024 });
const MAX_PASSWORD_BYTES = 1024;

export class PasswordHasher {
  constructor(options = {}) { this.options = { ...DEFAULT, ...options }; }
  validate(password) {
    if (typeof password !== "string") throw new TypeError("Password must be a string");
    const bytes = Buffer.byteLength(password, "utf8");
    if (password.length < 12) throw new Error("Password must be at least 12 characters");
    if (bytes > MAX_PASSWORD_BYTES) throw new Error("Password is too long");
  }
  async hash(password) {
    this.validate(password);
    const { N, r, p, keyLength, maxmem } = this.options;
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, keyLength, { N, r, p, maxmem });
    return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${Buffer.from(key).toString("base64url")}`;
  }
  async verify(encoded, password) {
    if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;
    const parts = String(encoded).split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nRaw, rRaw, pRaw, salt64, key64] = parts;
    const N = Number(nRaw), r = Number(rRaw), p = Number(pRaw);
    if (!Number.isInteger(N) || N < 16384 || N > 131072 || ![8].includes(r) || !Number.isInteger(p) || p < 1 || p > 4) return false;
    let salt, expected;
    try { salt = Buffer.from(salt64, "base64url"); expected = Buffer.from(key64, "base64url"); } catch { return false; }
    if (salt.length < 16 || expected.length < 32 || expected.length > 128) return false;
    try {
      const actual = Buffer.from(await scrypt(password, salt, expected.length, { N, r, p, maxmem: 128 * 1024 * 1024 }));
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch { return false; }
  }
  async fakeVerify(password) {
    const salt = Buffer.alloc(16, 7);
    try { await scrypt(String(password ?? ""), salt, 64, { ...DEFAULT }); } catch {}
    return false;
  }
}
