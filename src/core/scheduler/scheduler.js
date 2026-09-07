export class Scheduler {
  constructor({ jobs, logger }) { this.jobs=jobs; this.logger=logger; this.timers=new Map(); }
  every(id, intervalMs, jobId, payload={}) { if(this.timers.has(id)) throw new Error(`Schedule exists: ${id}`); const t=setInterval(()=>this.jobs.enqueue(jobId,payload).catch(err=>this.logger?.error({err,schedule:id},"schedule_failed")),intervalMs); t.unref?.(); this.timers.set(id,t); return ()=>this.clear(id); }
  clear(id){ const t=this.timers.get(id); if(t){clearInterval(t); this.timers.delete(id);} }
  close(){ for(const id of [...this.timers.keys()]) this.clear(id); }
}
