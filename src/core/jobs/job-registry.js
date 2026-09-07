export class JobRegistry {
  constructor(){ this.jobs=new Map(); }
  register(def){ if(!def?.id||typeof def.handler!=="function") throw new Error("Job requires id and handler"); if(this.jobs.has(def.id)) throw new Error(`Job already registered: ${def.id}`); this.jobs.set(def.id,{ timeoutMs:60000,retries:3,concurrency:1,...def}); return def; }
  get(id){ const j=this.jobs.get(id); if(!j) throw new Error(`Unknown job: ${id}`); return j; }
  list(){ return [...this.jobs.values()].map(({handler,...x})=>x); }
}
