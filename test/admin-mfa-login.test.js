import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../src/core/auth/auth-service.js";
import { TokenService } from "../src/core/security/token-service.js";
import { TotpService } from "../src/core/security/totp-service.js";
import { SecretBox } from "../src/core/security/secret-box.js";

test("framework admin password login requires MFA before session creation",async()=>{
  const secret="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", box=new SecretBox(Buffer.alloc(32,3)), tokens=new TokenService({pepper:"p".repeat(32)});
  let challengeHash=null,used=false,sessionCreated=false;
  const repo={
    findAccountByEmail:async()=>({account_id:"usr_1",email:"admin@example.com",password_hash:"ok",status:"active",authority_domain:"framework",framework_role:"super_admin"}),
    recordLoginAttempt:async()=>{},findTotpMethod:async()=>({secret_ciphertext:box.encrypt(secret),verified_at:new Date()}),
    createMfaChallenge:async({tokenHash})=>{challengeHash=tokenHash;return{};},
    findMfaChallenge:async hash=>hash===challengeHash?({challenge_id:"mfc_1",account_id:"usr_1",email:"admin@example.com",account_status:"active",authority_domain:"framework",framework_role:"super_admin",attempts:0,secret_ciphertext:box.encrypt(secret)}):null,
    incrementMfaChallengeAttempts:async()=>{},consumeRecoveryCode:async()=>false,consumeMfaChallenge:async()=>{used=true;return true;},
    createSession:async()=>{sessionCreated=true;return{session_id:"ses_1",expires_at:new Date()};}
  };
  const auth=new AuthService({repo,passwordHasher:{verify:async()=>true,fakeVerify:async()=>false},tokens,totp:new TotpService(),secretBox:box});
  const first=await auth.login({email:"admin@example.com",password:"correct"});assert.equal(first.mfa_required,true);assert.equal(sessionCreated,false);
  const original=Date.now;Date.now=()=>59000;try{const final=await auth.verifyMfa({challengeToken:first.challenge_token,code:"287082"});assert.equal(final.account.framework_role,"super_admin");assert.equal(sessionCreated,true);assert.equal(used,true);}finally{Date.now=original;}
});
