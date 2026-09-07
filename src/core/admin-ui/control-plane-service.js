import { newId } from "../ids/id.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

function safeInt(value){ const n=Number(value); return Number.isFinite(n)?n:0; }
function clamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.trunc(n))):fallback;}

export class ControlPlaneService {
  constructor({ database, health, moduleRegistry, themes, adminUi, frameworkVersion }) {
    Object.assign(this,{ database, health, moduleRegistry, themes, adminUi, frameworkVersion });
  }

  async overview() {
    const [health, counts, jobs, outbox, recent, security] = await Promise.all([
      this.health.run(),
      this.database.query(`SELECT
        (SELECT count(*) FROM core.applications) AS applications,
        (SELECT count(*) FROM core.applications WHERE status='ACTIVE') AS active_applications,
        (SELECT count(*) FROM core.tenants) AS tenants,
        (SELECT count(*) FROM core.tenants WHERE status='active') AS active_tenants,
        (SELECT count(*) FROM identity.sessions s JOIN identity.accounts a ON a.account_id=s.account_id WHERE s.revoked_at IS NULL AND s.expires_at>now() AND a.authority_domain='framework') AS active_sessions`),
      this.database.query(`SELECT status,count(*)::int AS count FROM infrastructure.jobs GROUP BY status`),
      this.database.query(`SELECT status,count(*)::int AS count FROM infrastructure.outbox_events GROUP BY status`),
      this.database.query(`SELECT audit_id,action,actor_id,app_id,tenant_id,target_type,target_id,created_at FROM audit.events ORDER BY created_at DESC LIMIT 8`),
      this.database.query(`SELECT count(*) FILTER (WHERE success=false)::int AS failed_logins,count(*) FILTER (WHERE success=true)::int AS successful_logins FROM identity.login_attempts WHERE created_at>=now()-interval '24 hours'`)
    ]);
    const c=counts.rows[0]??{};
    const modules=this.moduleRegistry.list();
    return {
      framework:{ version:this.frameworkVersion, status:health.status },
      counts:{
        applications:safeInt(c.applications), active_applications:safeInt(c.active_applications),
        tenants:safeInt(c.tenants), active_tenants:safeInt(c.active_tenants),
        modules:modules.length, active_modules:modules.filter(m=>m.status==="ENABLED").length,
        unhealthy_modules:modules.filter(m=>["INSTALL_FAILED","HEALTH_CHECK_FAILED","UPGRADE_FAILED"].includes(m.status)).length,
        active_sessions:safeInt(c.active_sessions)
      },
      health,
      jobs:Object.fromEntries(jobs.rows.map(r=>[r.status,safeInt(r.count)])),
      outbox:Object.fromEntries(outbox.rows.map(r=>[r.status,safeInt(r.count)])),
      security_24h:security.rows[0]??{failed_logins:0,successful_logins:0},
      recent_activity:recent.rows
    };
  }

  async applications({limit=100,offset=0}={}) {
    limit=clamp(limit,1,250,100);offset=clamp(offset,0,100000,0);
    const { rows }=await this.database.query(`SELECT a.app_id,a.name,a.status,a.base_url,a.tenant_mode,a.created_at,a.updated_at,
      (SELECT count(*)::int FROM core.tenants t WHERE t.app_id=a.app_id) AS tenant_count,
      (SELECT count(*)::int FROM core.application_modules m WHERE m.app_id=a.app_id AND m.enabled=true) AS enabled_module_count
      FROM core.applications a ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);
    return rows;
  }

  async createApplication({name,baseUrl=null,tenantMode="OPTIONAL",deliveryMode="fullstack"}){
    name=String(name??"").trim();tenantMode=String(tenantMode??"OPTIONAL").toUpperCase();
    if(!name||name.length>160)throw new AppError({code:ErrorCodes.VALIDATION_FAILED,message:"Application name is required",status:400});
    if(!["DISABLED","OPTIONAL","REQUIRED"].includes(tenantMode))throw new AppError({code:ErrorCodes.VALIDATION_FAILED,message:"Invalid tenant mode",status:400});
    if(baseUrl){try{baseUrl=new URL(String(baseUrl)).toString();}catch{throw new AppError({code:ErrorCodes.VALIDATION_FAILED,message:"Invalid application base URL",status:400});}}
    deliveryMode=String(deliveryMode??"fullstack").toLowerCase();
    if(!["fullstack","headless","hybrid"].includes(deliveryMode))throw new AppError({code:ErrorCodes.VALIDATION_FAILED,message:"Invalid delivery mode",status:400});
    const appId=newId("app");
    const activeTheme=deliveryMode==="headless"?null:"framework.default";
    const {rows}=await this.database.query(`INSERT INTO core.applications(app_id,name,status,base_url,tenant_mode,delivery_mode,api_enabled,active_theme_id,created_at,updated_at) VALUES($1,$2,'ACTIVE',$3,$4,$5,true,$6,now(),now()) RETURNING app_id,name,status,base_url,tenant_mode,delivery_mode,api_enabled,cors_allowed_origins,active_theme_id,created_at,updated_at`,[appId,name,baseUrl,tenantMode,deliveryMode,activeTheme]);
    return rows[0];
  }

  modules() {
    return this.moduleRegistry.list().map(({ impl, manifestPath, ...m })=>({ ...m, capability_count:(m.provides??[]).length, permission_count:(m.permissions??[]).length, required_dependency_count:(m.dependencies?.required??[]).length, optional_dependency_count:(m.dependencies?.optional??[]).length }));
  }

  themesList() { return this.themes.list().map(t=>({ id:t.id,name:t.name,version:t.version,status:t.status,parent:t.parent??null })); }

  async operations() {
    const [jobs,outbox]=await Promise.all([
      this.database.query(`SELECT job_id,job_type,status,attempts,max_attempts,available_at,created_at,completed_at,failed_at,last_error FROM infrastructure.jobs ORDER BY created_at DESC LIMIT 100`),
      this.database.query(`SELECT event_id,event_type,event_version,status,attempts,created_at,published_at,last_error FROM infrastructure.outbox_events ORDER BY created_at DESC LIMIT 100`)
    ]);
    return { jobs:jobs.rows, outbox:outbox.rows };
  }

  async audit(limit=100) {
    const n=clamp(limit,1,250,100);
    const { rows }=await this.database.query(`SELECT audit_id,action,actor_id,app_id,tenant_id,target_type,target_id,metadata,created_at FROM audit.events ORDER BY created_at DESC LIMIT $1`,[n]);
    return rows;
  }

  async securitySummary(){
    const [admins,sessions,attempts]=await Promise.all([
      this.database.query(`SELECT fa.framework_role,count(*)::int AS count FROM identity.framework_admins fa JOIN identity.accounts a ON a.account_id=fa.account_id WHERE a.status='active' GROUP BY fa.framework_role ORDER BY fa.framework_role`),
      this.database.query(`SELECT count(*)::int AS active_sessions FROM identity.sessions s JOIN identity.accounts a ON a.account_id=s.account_id WHERE s.revoked_at IS NULL AND s.expires_at>now() AND a.authority_domain='framework'`),
      this.database.query(`SELECT count(*) FILTER (WHERE success=false)::int AS failed_24h,count(*) FILTER (WHERE success=true)::int AS successful_24h FROM identity.login_attempts WHERE created_at>=now()-interval '24 hours'`)
    ]);
    return {administrators:admins.rows,active_sessions:safeInt(sessions.rows[0]?.active_sessions),login_attempts:attempts.rows[0]??{failed_24h:0,successful_24h:0}};
  }

  async frameworkSettings(){const {rows}=await this.database.query(`SELECT framework_name,application_name,public_url,admin_url,default_locale,timezone,server_type,updated_at FROM core.framework_settings WHERE singleton=true`);return rows[0]??null;}
  async updateFrameworkSettings(input,actorId=null){const current=await this.frameworkSettings();if(!current)throw new AppError({code:ErrorCodes.NOT_FOUND,message:"Framework settings not found",status:404});const name=String(input.framework_name??current.framework_name).trim();if(name.length<2||name.length>120)throw new AppError({code:ErrorCodes.VALIDATION_FAILED,message:"Framework name must be 2-120 characters",status:400});const locale=String(input.default_locale??current.default_locale).slice(0,16);const timezone=String(input.timezone??current.timezone).slice(0,64);const {rows}=await this.database.query(`UPDATE core.framework_settings SET framework_name=$1,default_locale=$2,timezone=$3,updated_at=now() WHERE singleton=true RETURNING framework_name,application_name,public_url,admin_url,default_locale,timezone,server_type,updated_at`,[name,locale,timezone]);await this.database.query(`INSERT INTO audit.events(action,actor_id,target_type,target_id,metadata) VALUES('framework.settings.updated',$1,'framework','singleton',$2::jsonb)`,[actorId,JSON.stringify({framework_name:name,default_locale:locale,timezone})]);return rows[0];}

  navigation() { return this.adminUi.list(); }
}
