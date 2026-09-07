import { createHash } from "node:crypto";
import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

export class IdempotencyService {
  constructor({ cache, ttlSeconds = 86400, lockSeconds = 30 }) { Object.assign(this, { cache, ttlSeconds, lockSeconds }); }
  fingerprint(input) { return createHash("sha256").update(JSON.stringify(input ?? null)).digest("hex"); }
  async execute(key, operation, { scope = "global", request = null } = {}) {
    if (!key) return operation();
    if (typeof key !== "string" || key.length < 8 || key.length > 200) throw new AppError({ code: ErrorCodes.VALIDATION_FAILED, message: "Invalid idempotency key", status: 400 });
    const base = `idempotency:${scope}:${key}`;
    const resultKey = `${base}:result`; const lockKey = `${base}:lock`; const fingerprint = this.fingerprint(request);
    const prior = await this.cache.get(resultKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new AppError({ code: ErrorCodes.IDEMPOTENCY_CONFLICT, message: "Idempotency key was already used for a different request", status: 409 });
      return prior.result;
    }
    const acquired = await this.cache.setIfAbsent(lockKey, { fingerprint }, { ttlSeconds: this.lockSeconds });
    if (!acquired) throw new AppError({ code: ErrorCodes.CONFLICT, message: "An operation with this idempotency key is already in progress", status: 409 });
    try {
      const result = await operation();
      await this.cache.set(resultKey, { fingerprint, result }, { ttlSeconds: this.ttlSeconds });
      return result;
    } finally { await this.cache.delete(lockKey); }
  }
}
