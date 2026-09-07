import { createClient } from "redis";
export class RedisCache {
  constructor({ url, logger }) {
    this.logger = logger;
    this.client = createClient({ url, socket: { reconnectStrategy: retries => Math.min(1000, 50 * 2 ** Math.min(retries, 5)) } });
    this.client.on("error", err => this.logger.error({ err }, "redis_error"));
  }
  async connect() { if (!this.client.isOpen) await this.client.connect(); }
  async ping() { return (await this.client.ping()) === "PONG"; }
  async get(key) { const value = await this.client.get(key); return value == null ? null : JSON.parse(value); }
  async set(key, value, { ttlSeconds } = {}) {
    const payload = JSON.stringify(value);
    return ttlSeconds ? this.client.set(key, payload, { EX: ttlSeconds }) : this.client.set(key, payload);
  }
  async setIfAbsent(key, value, { ttlSeconds = 30 } = {}) {
    const result = await this.client.set(key, JSON.stringify(value), { NX: true, EX: ttlSeconds });
    return result === "OK";
  }
  async increment(key, { ttlSeconds } = {}) {
    const tx = this.client.multi().incr(key);
    if (ttlSeconds) tx.ttl(key);
    const result = await tx.exec();
    const value = Number(result[0]);
    if (ttlSeconds && Number(result[1]) < 0) await this.client.expire(key, ttlSeconds);
    return value;
  }
  async delete(key) { await this.client.del(key); }
  async close() { if (this.client.isOpen) await this.client.quit(); }
}
