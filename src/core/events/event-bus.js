export class EventBus {
  constructor({ logger }) { this.logger=logger; this.handlers=new Map(); }
  subscribe(type, handler){ const a=this.handlers.get(type)??[]; a.push(handler); this.handlers.set(type,a); return ()=>this.handlers.set(type,(this.handlers.get(type)??[]).filter(h=>h!==handler)); }
  async publish(event){ const handlers=[...(this.handlers.get(event.type)??[]), ...(this.handlers.get("*")??[])]; const results=[]; for(const h of handlers){ try{ results.push(await h(event)); } catch(err){ this.logger?.error({err,event_type:event.type},"event_handler_failed"); throw err; } } return results; }
}
