import { newId } from "../ids/id.js";
export class FrameworkSetupRepository {
  constructor(database){ this.db=database; }
  async saveSettings({ frameworkName, publicUrl, adminUrl, locale, timezone, serverType="local", applicationName=null }) {
    const {rows}=await this.db.query(`UPDATE core.framework_settings SET framework_name=$1,public_url=$2,admin_url=$3,default_locale=$4,timezone=$5,server_type=$6,application_name=$7,updated_at=now() WHERE singleton=true RETURNING *`,[frameworkName,publicUrl,adminUrl,locale,timezone,serverType,applicationName]);
    return rows[0];
  }
  async getSettings(){ const {rows}=await this.db.query(`SELECT * FROM core.framework_settings WHERE singleton=true`); return rows[0]??null; }
  async getInitialAdmin(){ const {rows}=await this.db.query(`SELECT a.account_id,a.email,a.status,a.authority_domain,fa.framework_role FROM identity.framework_admins fa JOIN identity.accounts a ON a.account_id=fa.account_id WHERE fa.framework_role='super_admin' AND a.status='active' ORDER BY a.created_at LIMIT 1`); return rows[0]??null; }
  async createInitialAdmin({ email, passwordHash }) {
    return this.db.transaction(async tx=>{
      const state=await tx.query(`SELECT installation_status FROM core.framework_state WHERE singleton=true FOR UPDATE`);
      if(state.rows[0]?.installation_status!=='SETUP_REQUIRED') return null;
      const existing=await tx.query(`SELECT a.account_id,a.email,a.status,a.authority_domain,fa.framework_role FROM identity.framework_admins fa JOIN identity.accounts a ON a.account_id=fa.account_id WHERE fa.framework_role='super_admin' AND a.status='active' ORDER BY a.created_at LIMIT 1`);
      if(existing.rows[0]) return existing.rows[0];
      const id=newId("usr");
      await tx.query(`INSERT INTO identity.accounts(account_id,email,status,authority_domain,created_at) VALUES($1,$2,'active','framework',now())`,[id,email]);
      await tx.query(`INSERT INTO identity.password_credentials(account_id,password_hash,updated_at) VALUES($1,$2,now())`,[id,passwordHash]);
      await tx.query(`INSERT INTO identity.framework_admins(account_id,framework_role,created_at) VALUES($1,'super_admin',now())`,[id]);
      await tx.query(`UPDATE core.framework_state SET initial_admin_created_at=COALESCE(initial_admin_created_at,now()) WHERE singleton=true`);
      return {account_id:id,email,status:'active',authority_domain:'framework',framework_role:'super_admin'};
    });
  }
  async saveTotp({ accountId, secretCiphertext, recoveryHashes }) {
    return this.db.transaction(async tx=>{
      await tx.query(`INSERT INTO identity.mfa_methods(mfa_id,account_id,method_type,secret_ciphertext,verified_at) VALUES($1,$2,'totp',$3,now()) ON CONFLICT(account_id,method_type) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext,verified_at=now()`,[newId("mfa"),accountId,secretCiphertext]);
      await tx.query(`DELETE FROM identity.mfa_recovery_codes WHERE account_id=$1 AND used_at IS NULL`,[accountId]);
      for(const hash of recoveryHashes) await tx.query(`INSERT INTO identity.mfa_recovery_codes(recovery_id,account_id,code_hash) VALUES($1,$2,$3)`,[newId("rcv"),accountId,hash]);
    });
  }
  async createInitialApplication({name,baseUrl,deliveryMode='fullstack'}){ const id=newId('app'); const {rows}=await this.db.query(`INSERT INTO core.applications(app_id,name,status,base_url,tenant_mode,delivery_mode,api_enabled,active_theme_id,created_at,updated_at) VALUES($1,$2,'ACTIVE',$3,'OPTIONAL',$4,true,$5,now(),now()) RETURNING *`,[id,name,baseUrl,deliveryMode,deliveryMode==='headless'?null:'framework.default']); return rows[0]; }
  async finalize({ frameworkVersion }) {
    const {rows}=await this.db.query(`UPDATE core.framework_state s SET installation_status='INITIALIZED',initialized_at=COALESCE(initialized_at,now()),setup_locked_at=COALESCE(setup_locked_at,now()),framework_version=$1 WHERE singleton=true AND installation_status='SETUP_REQUIRED' AND EXISTS(SELECT 1 FROM identity.framework_admins fa WHERE fa.framework_role='super_admin') RETURNING *`,[frameworkVersion]);
    return rows[0]??null;
  }
}
