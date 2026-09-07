export class ModuleRegistry {
  constructor(){this.modules=new Map();}
  add(record){ if(this.modules.has(record.id)) throw new Error(`Module already registered: ${record.id}`); this.modules.set(record.id,record); return record; }
  get(id){return this.modules.get(id)??null;} list(){return [...this.modules.values()];}
}
