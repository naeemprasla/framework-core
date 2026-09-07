export class RateLimiter {
  constructor({ cache, prefix="ratelimit" }){ this.cache=cache; this.prefix=prefix; }
  async check(key,{limit=100,windowSeconds=60}={}){ const k=`${this.prefix}:${key}`; const n=await this.cache.increment(k,{ttlSeconds:windowSeconds}); return {allowed:n<=limit,limit,remaining:Math.max(0,limit-n)}; }
}
