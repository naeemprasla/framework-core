export class HealthRegistry {
  #checks = new Map();
  register(name, check, { critical=true, timeoutMs=2000 }={}) {
    if(typeof check!=="function") throw new TypeError("Health check must be a function");
    this.#checks.set(name,{check,critical,timeoutMs}); return this;
  }
  async run() {
    const checks={}; let ready=true;
    await Promise.all([...this.#checks.entries()].map(async([name,item])=>{
      const started=performance.now(); let timer;
      try {
        await Promise.race([Promise.resolve(item.check()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Health check timed out")),item.timeoutMs);})]);
        checks[name]={status:"up",critical:item.critical,latency_ms:Math.round(performance.now()-started)};
      } catch { checks[name]={status:"down",critical:item.critical,latency_ms:Math.round(performance.now()-started)}; if(item.critical)ready=false; }
      finally {if(timer)clearTimeout(timer);}
    }));
    return {status:ready?"ready":"not_ready",checks};
  }
  async runAll(){return this.run();}
}
