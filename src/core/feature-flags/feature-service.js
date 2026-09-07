export class FeatureService {
  constructor({ cache }) { this.cache=cache; }
  async set(appId,key,value) { await this.cache.set(`feature:${appId}:${key}`, value); }
  async get(appId,key,defaultValue=false) { const value=await this.cache.get(`feature:${appId}:${key}`); return value==null?defaultValue:value; }
  async enabled(appId,key,ctx={}) {
    const value=await this.get(appId,key,false);
    if(typeof value==="boolean") return value;
    if(value?.enabled===false) return false;
    if(Array.isArray(value?.tenants) && ctx.tenantId) return value.tenants.includes(ctx.tenantId);
    return Boolean(value?.enabled);
  }
}
