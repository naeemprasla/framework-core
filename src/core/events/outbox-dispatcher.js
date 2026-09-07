export class OutboxDispatcher {
  constructor({ outbox, events, logger, pollIntervalMs = 250 }) { Object.assign(this,{outbox,events,logger,pollIntervalMs}); this.running=false; this.timer=null; this.inFlight=false; }
  start() {
    if (this.running) return; this.running=true;
    const tick=async()=>{ if(!this.running||this.inFlight)return; this.inFlight=true; try{await this.drainOnce();}catch(err){this.logger?.error({err},"outbox_dispatch_failed");}finally{this.inFlight=false;} };
    this.timer=setInterval(tick,this.pollIntervalMs); this.timer.unref?.(); queueMicrotask(tick);
  }
  async drainOnce(){ const records=await this.outbox.claim(100); for(const record of records){ try{ const event=typeof record.payload==='string'?JSON.parse(record.payload):record.payload; await this.events.publish(event); await this.outbox.markPublished(record.event_id); }catch(err){ await this.outbox.markFailed(record.event_id,err,record.attempts); this.logger?.error({err,event_id:record.event_id,event_type:record.event_type},"outbox_event_failed"); } } return records.length; }
  async close(){this.running=false;if(this.timer)clearInterval(this.timer);this.timer=null;while(this.inFlight)await new Promise(r=>setTimeout(r,10));}
}
