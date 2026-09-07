export class ProviderRegistry {
  constructor(){ this.providers=new Map(); }
  register(type, name, provider, { makeDefault=false }={}) {
    if(!type||!name) throw new Error("Provider type and name are required");
    const bucket=this.providers.get(type) ?? { defaultName:null, items:new Map() };
    if(bucket.items.has(name)) throw new Error(`Provider already registered: ${type}:${name}`);
    bucket.items.set(name, provider); if(makeDefault || !bucket.defaultName) bucket.defaultName=name;
    this.providers.set(type,bucket); return this;
  }
  get(type,name){ const b=this.providers.get(type); const key=name ?? b?.defaultName; if(!b||!key||!b.items.has(key)) throw new Error(`Provider not found: ${type}:${name??"default"}`); return b.items.get(key); }
  has(type,name){ const b=this.providers.get(type); return !!b && b.items.has(name ?? b.defaultName); }
  list(type){ const b=this.providers.get(type); return b ? [...b.items.keys()] : []; }
}
