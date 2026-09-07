import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../src/core/auth/auth-service.js";
import { TokenService } from "../src/core/security/token-service.js";
import { TotpService } from "../src/core/security/totp-service.js";
import { SecretBox } from "../src/core/security/secret-box.js";

test("MFA challenge must be atomically consumed before session creation",async()=>{
  const box=new SecretBox(Buffer.alloc(32,4)), tokens=new TokenService({pepper:"z".repeat(32)});let sessions=0;
  const challenge={challenge_id:"mfc_1",account_id:"usr_1",email:"admin@example.com",account_status:"active",authority_domain:"framework",framework_role:"super_admin",attempts:0,secret_ciphertext:box.encrypt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")};
  let consumed=false;
  const repo={findMfaChallenge:async()=>challenge,consumeRecoveryCode:async()=>true,incrementMfaChallengeAttempts:async()=>{},consumeMfaChallenge:async()=>{if(consumed)return false;consumed=true;return true;},createSession:async()=>({session_id:`ses_${++sessions}`,expires_at:new Date(Date.now()+10000)})};
  const auth=new AuthService({repo,passwordHasher:{},tokens,totp:new TotpService(),secretBox:box});
  const one=await auth.verifyMfa({challengeToken:"a".repeat(40),code:"RECOVERY"});assert.equal(one.session.session_id,"ses_1");
  await assert.rejects(()=>auth.verifyMfa({challengeToken:"a".repeat(40),code:"RECOVERY"}),err=>err?.code==="unauthorized");
  assert.equal(sessions,1);
});
