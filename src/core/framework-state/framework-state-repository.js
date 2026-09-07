export class FrameworkStateRepository {
  constructor(database) { this.database = database; }
  async get() {
    const result = await this.database.query(`SELECT instance_id, installation_status, schema_version, installed_at, initialized_at, initial_admin_created_at, setup_locked_at, framework_version FROM core.framework_state WHERE singleton = true`);
    return result.rows[0] ?? null;
  }
  async completeInitialSetup({ frameworkVersion }) {
    const { rows } = await this.database.query(`UPDATE core.framework_state SET installation_status='INITIALIZED', initialized_at=COALESCE(initialized_at,now()), initial_admin_created_at=COALESCE(initial_admin_created_at,now()), setup_locked_at=COALESCE(setup_locked_at,now()), framework_version=$1 WHERE singleton=true AND installation_status='SETUP_REQUIRED' AND EXISTS (SELECT 1 FROM identity.framework_admins fa JOIN identity.accounts a ON a.account_id=fa.account_id JOIN identity.mfa_methods m ON m.account_id=fa.account_id AND m.method_type='totp' WHERE fa.framework_role='super_admin' AND a.status='active' AND m.verified_at IS NOT NULL) RETURNING *`, [frameworkVersion]);
    return rows[0] ?? null;
  }
}
