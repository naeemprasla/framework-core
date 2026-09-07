export class AuditService {
  constructor(db){ this.db=db; }
  async record({action,actorId=null,appId=null,tenantId=null,targetType=null,targetId=null,metadata={}}){ await this.db.query(`INSERT INTO audit.events(action,actor_id,app_id,tenant_id,target_type,target_id,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())`,[action,actorId,appId,tenantId,targetType,targetId,JSON.stringify(metadata)]); }
}
