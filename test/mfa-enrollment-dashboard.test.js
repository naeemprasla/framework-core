import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../src/core/auth/auth-service.js";
import { TokenService } from "../src/core/security/token-service.js";
import { SecretBox } from "../src/core/security/secret-box.js";
test("dashboard MFA enrollment persists verified TOTP and recovery hashes",async()=>{let saved=null;const repo={findTotpMethod:async()=>null,saveTotpEnrollment:async v=>{saved=v;}};const totp={generateSecret:()=>"TESTSECRET",uri:()=>"otpauth://totp/test",verify:()=>true};const secretBox=new SecretBox(Buffer.alloc(32,4));const tokens=new TokenService({pepper:"p".repeat(32)});const auth=new AuthService({repo,passwordHasher:{},tokens,totp,secretBox});const account={account_id:"usr_admin",email:"admin@example.com"};const start=await auth.beginMfaEnrollment(account);const done=await auth.completeMfaEnrollment({account,enrollmentToken:start.enrollment_token,code:"123456"});assert.equal(done.enrolled,true);assert.equal(done.recovery_codes.length,10);assert.ok(saved.secretCiphertext);assert.equal(saved.recoveryHashes.length,10);assert.notEqual(saved.recoveryHashes[0],done.recovery_codes[0]);});
