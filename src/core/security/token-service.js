import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export class TokenService {
  constructor({ pepper = null } = {}) { this.pepper = pepper; }
  generate(bytes = 32) {
    if (!Number.isInteger(bytes) || bytes < 24 || bytes > 128) throw new TypeError("Token byte length out of range");
    return randomBytes(bytes).toString("base64url");
  }
  hash(token) {
    const value = String(token);
    return this.pepper
      ? createHmac("sha256", this.pepper).update(value).digest("hex")
      : createHash("sha256").update(value).digest("hex");
  }
  equals(a, b) {
    const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
  }
}
