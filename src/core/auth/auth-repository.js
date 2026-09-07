import { newId } from "../ids/id.js";
export class AuthRepository {
  constructor(db) { this.db = db; }
  async findAccountByEmail(email) {
    const { rows } = await this.db.query(`SELECT a.*,c.password_hash,fa.framework_role FROM identity.accounts a LEFT JOIN identity.password_credentials c ON c.account_id=a.account_id LEFT JOIN identity.framework_admins fa ON fa.account_id=a.account_id WHERE lower(a.email)=lower($1)`, [email]);
    return rows[0] ?? null;
  }
  async createAccount({ email, passwordHash, authorityDomain = "application", frameworkRole = null }) {
    return this.db.transaction(async tx => {
      const id = newId("usr");
      await tx.query(`INSERT INTO identity.accounts(account_id,email,status,authority_domain,created_at) VALUES($1,$2,'active',$3,now())`, [id, email, authorityDomain]);
      await tx.query(`INSERT INTO identity.password_credentials(account_id,password_hash,updated_at) VALUES($1,$2,now())`, [id, passwordHash]);
      if (authorityDomain === "framework") {
        await tx.query(`INSERT INTO identity.framework_admins(account_id,framework_role,created_at) VALUES($1,$2,now())`, [id, frameworkRole ?? "admin"]);
      }
      return { account_id:id, email, status:"active", authority_domain:authorityDomain, framework_role:frameworkRole };
    });
  }

  async bootstrapSuperAdmin({ email, passwordHash, frameworkVersion }) {
    return this.db.transaction(async tx => {
      const state = await tx.query(`SELECT installation_status FROM core.framework_state WHERE singleton=true FOR UPDATE`);
      if (state.rows[0]?.installation_status !== 'SETUP_REQUIRED') return null;
      const admins = await tx.query(`SELECT count(*)::int AS count FROM identity.framework_admins fa JOIN identity.accounts a ON a.account_id=fa.account_id WHERE a.status='active'`);
      if (admins.rows[0].count > 0) return null;
      const id = newId("usr");
      await tx.query(`INSERT INTO identity.accounts(account_id,email,status,authority_domain,created_at) VALUES($1,$2,'active','framework',now())`, [id,email]);
      await tx.query(`INSERT INTO identity.password_credentials(account_id,password_hash,updated_at) VALUES($1,$2,now())`, [id,passwordHash]);
      await tx.query(`INSERT INTO identity.framework_admins(account_id,framework_role,created_at) VALUES($1,'super_admin',now())`, [id]);
      await tx.query(`UPDATE core.framework_state SET initial_admin_created_at=COALESCE(initial_admin_created_at,now()) WHERE singleton=true`, []);
      return { account_id:id,email,status:'active',authority_domain:'framework',framework_role:'super_admin' };
    });
  }
  async createSession({ accountId, tokenHash, expiresAt, ip = null, userAgent = null }) {
    const id = newId("ses");
    await this.db.query(`INSERT INTO identity.sessions(session_id,account_id,token_hash,expires_at,ip,user_agent,created_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,now(),now())`, [id, accountId, tokenHash, expiresAt, ip, userAgent]);
    return { session_id:id, account_id:accountId, expires_at:expiresAt };
  }
  async findSessionByTokenHash(hash) {
    const { rows } = await this.db.query(`SELECT s.session_id,s.account_id,s.expires_at,s.created_at,s.last_seen_at,a.email,a.status AS account_status,a.authority_domain,fa.framework_role FROM identity.sessions s JOIN identity.accounts a ON a.account_id=s.account_id LEFT JOIN identity.framework_admins fa ON fa.account_id=a.account_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`, [hash]);
    return rows[0] ?? null;
  }
  async touchSession(id) { await this.db.query(`UPDATE identity.sessions SET last_seen_at=now() WHERE session_id=$1 AND last_seen_at < now() - interval '5 minutes'`, [id]); }
  async revokeSession(id, accountId = null) { await this.db.query(`UPDATE identity.sessions SET revoked_at=now() WHERE session_id=$1 AND ($2::text IS NULL OR account_id=$2)`, [id, accountId]); }
  async revokeAllSessions(accountId, exceptSessionId = null) { await this.db.query(`UPDATE identity.sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL AND ($2::text IS NULL OR session_id<>$2)`, [accountId, exceptSessionId]); }
  async countFrameworkAdmins() { const { rows } = await this.db.query(`SELECT count(*)::int AS count FROM identity.framework_admins fa JOIN identity.accounts a ON a.account_id=fa.account_id WHERE a.authority_domain='framework' AND a.status='active'`); return rows[0].count; }
  async saveTotpEnrollment({accountId,secretCiphertext,recoveryHashes}){return this.db.transaction(async tx=>{await tx.query(`INSERT INTO identity.mfa_methods(mfa_id,account_id,method_type,secret_ciphertext,verified_at) VALUES($1,$2,'totp',$3,now()) ON CONFLICT(account_id,method_type) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext,verified_at=now()`,[newId("mfa"),accountId,secretCiphertext]);await tx.query(`DELETE FROM identity.mfa_recovery_codes WHERE account_id=$1 AND used_at IS NULL`,[accountId]);for(const hash of recoveryHashes)await tx.query(`INSERT INTO identity.mfa_recovery_codes(recovery_id,account_id,code_hash) VALUES($1,$2,$3)`,[newId("rcv"),accountId,hash]);return true;});}
  async findTotpMethod(accountId) { const { rows } = await this.db.query(`SELECT mfa_id,account_id,secret_ciphertext,verified_at FROM identity.mfa_methods WHERE account_id=$1 AND method_type='totp'`, [accountId]); return rows[0] ?? null; }
  async createMfaChallenge({ accountId, tokenHash, expiresAt, ip = null, userAgent = null }) { const id=newId("mfc"); await this.db.query(`INSERT INTO identity.mfa_challenges(challenge_id,account_id,token_hash,expires_at,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6)`,[id,accountId,tokenHash,expiresAt,ip,String(userAgent??"").slice(0,512)||null]); return {challenge_id:id,account_id:accountId,expires_at:expiresAt}; }
  async findMfaChallenge(tokenHash) { const {rows}=await this.db.query(`SELECT c.*,a.email,a.status AS account_status,a.authority_domain,fa.framework_role,m.secret_ciphertext FROM identity.mfa_challenges c JOIN identity.accounts a ON a.account_id=c.account_id LEFT JOIN identity.framework_admins fa ON fa.account_id=a.account_id LEFT JOIN identity.mfa_methods m ON m.account_id=a.account_id AND m.method_type='totp' WHERE c.token_hash=$1 AND c.used_at IS NULL AND c.expires_at>now() FOR UPDATE`,[tokenHash]); return rows[0]??null; }
  async consumeMfaChallenge(id){const {rows}=await this.db.query(`UPDATE identity.mfa_challenges SET used_at=now() WHERE challenge_id=$1 AND used_at IS NULL AND expires_at>now() RETURNING challenge_id`,[id]);return Boolean(rows[0]);}
  async incrementMfaChallengeAttempts(id){await this.db.query(`UPDATE identity.mfa_challenges SET attempts=attempts+1 WHERE challenge_id=$1`,[id]);}
  async consumeRecoveryCode({accountId,codeHash}){const {rows}=await this.db.query(`UPDATE identity.mfa_recovery_codes SET used_at=now() WHERE account_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING recovery_id`,[accountId,codeHash]);return Boolean(rows[0]);}

  async recordLoginAttempt({ email, success, ip = null }) { await this.db.query(`INSERT INTO identity.login_attempts(email,success,ip,created_at) VALUES($1,$2,$3,now())`, [email, success, ip]); }
}
