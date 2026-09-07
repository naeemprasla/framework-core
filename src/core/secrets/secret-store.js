export class SecretStore {
  constructor({ env=process.env }){ this.env=env; }
  get(name,{required=true}={}){ const v=this.env[name]; if(required && !v) throw new Error(`Missing secret: ${name}`); return v??null; }
}
