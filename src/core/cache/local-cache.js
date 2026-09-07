/**
 * Process-local cache for small/single-instance deployments.
 * Not suitable for cross-instance coordination. Redis can be enabled later
 * without changing consumers because both implement the same cache contract.
 */
export class LocalCache {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.values = new Map();
  }

  #now() { return Date.now(); }
  #getEntry(key) {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= this.#now()) {
      this.values.delete(key);
      return null;
    }
    return entry;
  }

  async connect() { return true; }
  async ping() { return true; }

  async get(key) {
    const entry = this.#getEntry(key);
    return entry ? structuredClone(entry.value) : null;
  }

  async set(key, value, { ttlSeconds } = {}) {
    this.values.set(key, {
      value: structuredClone(value),
      expiresAt: ttlSeconds ? this.#now() + (ttlSeconds * 1000) : null
    });
    return "OK";
  }

  async setIfAbsent(key, value, { ttlSeconds = 30 } = {}) {
    if (this.#getEntry(key)) return false;
    await this.set(key, value, { ttlSeconds });
    return true;
  }

  async increment(key, { ttlSeconds } = {}) {
    const existing = this.#getEntry(key);
    const next = Number(existing?.value ?? 0) + 1;
    const expiresAt = existing?.expiresAt ?? (ttlSeconds ? this.#now() + ttlSeconds * 1000 : null);
    this.values.set(key, { value: next, expiresAt });
    return next;
  }

  async delete(key) { this.values.delete(key); }
  async close() { this.values.clear(); }
}
