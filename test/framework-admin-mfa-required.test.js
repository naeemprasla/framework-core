import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../src/core/auth/auth-service.js";
import { TokenService } from "../src/core/security/token-service.js";
import { TotpService } from "../src/core/security/totp-service.js";
import { SecretBox } from "../src/core/security/secret-box.js";

test("framework authority account without enrolled MFA can sign in and enroll MFA later", async()=>{
  let sessionCreated=false;
  const repo={
    findAccountByEmail:async()=>({account_id:"usr_1",email:"admin@example.com",password_hash:"hash",status:"active",authority_domain:"framework",framework_role:"admin"}),
    recordLoginAttempt:async()=>{},findTotpMethod:async()=>null,
    createSession:async()=>{sessionCreated=true;return{session_id:"ses_1",expires_at:new Date(Date.now()+1000)}}
  };
  const auth=new AuthService({repo,passwordHasher:{verify:async()=>true,fakeVerify:async()=>false},tokens:new TokenService({pepper:"x".repeat(32)}),totp:new TotpService(),secretBox:new SecretBox(Buffer.alloc(32,1))});
  const result=await auth.login({email:"admin@example.com",password:"valid password"});
  assert.equal(sessionCreated,true);assert.equal(result.account.framework_role,"admin");assert.equal(result.mfa_required,undefined);
});
