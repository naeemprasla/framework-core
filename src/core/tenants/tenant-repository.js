import { newId } from "../ids/id.js";
export class TenantRepository {
  constructor(db){this.db=db;}
  async create({appId,name,slug}){const id=newId("ten");const {rows}=await this.db.query(`INSERT INTO core.tenants(tenant_id,app_id,name,slug,status,created_at) VALUES($1,$2,$3,$4,'active',now()) RETURNING tenant_id,app_id,name,slug,status,created_at`,[id,appId,name,slug]);return rows[0];}
  async find(id){const {rows}=await this.db.query(`SELECT tenant_id,app_id,name,slug,status,created_at FROM core.tenants WHERE tenant_id=$1`,[id]);return rows[0]??null;}
}
