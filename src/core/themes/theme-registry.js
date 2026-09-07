export class ThemeRegistry {
  constructor(){this.themes=new Map();this.activeByApp=new Map();}
  register(t){if(this.themes.has(t.id))throw new Error(`Theme exists: ${t.id}`);this.themes.set(t.id,t);return t;}
  activate(appId,id){if(!this.themes.has(id))throw new Error(`Theme not found: ${id}`);this.activeByApp.set(appId,id);}
  resolve(appId){return this.themes.get(this.activeByApp.get(appId))??this.themes.get("framework.default")??null;}
  list(){return [...this.themes.values()];}
}
