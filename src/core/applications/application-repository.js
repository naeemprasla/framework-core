export class ApplicationRepository {
  constructor(database) { this.database = database; }
  async findById(appId) {
    const result = await this.database.query(`SELECT app_id, name, status, base_url, tenant_mode, delivery_mode, api_enabled, cors_allowed_origins, active_theme_id, created_at, updated_at FROM core.applications WHERE app_id = $1`, [appId]);
    return result.rows[0] ?? null;
  }
}
