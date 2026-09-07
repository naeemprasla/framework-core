import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Kernel } from "../src/core/kernel/kernel.js";
import { EventBus } from "../src/core/events/event-bus.js";
import { OutboxDispatcher } from "../src/core/events/outbox-dispatcher.js";
import { JobRegistry } from "../src/core/jobs/job-registry.js";
import { JobQueue } from "../src/core/jobs/job-queue.js";
import { PasswordHasher } from "../src/core/security/password-hasher.js";
import { TokenService } from "../src/core/security/token-service.js";
import { TotpService } from "../src/core/security/totp-service.js";
import { SecretBox } from "../src/core/security/secret-box.js";
import { AuthService } from "../src/core/auth/auth-service.js";
import { RateLimiter } from "../src/core/rate-limit/rate-limiter.js";
import { createAuthenticationMiddleware, createFrameworkAdminMiddleware } from "../src/core/auth/auth-middleware.js";
import { AdminAuthorization } from "../src/core/admin-auth/admin-authorization.js";
import { createModuleContext } from "../src/core/modules/module-context.js";
import { ThemeRegistry } from "../src/core/themes/theme-registry.js";
import { FeatureService } from "../src/core/feature-flags/feature-service.js";
import { IdempotencyService } from "../src/core/idempotency/idempotency-service.js";
import { defineRoute } from "../src/core/http/define-route.js";

class MemoryCache {
  constructor(){ this.m = new Map(); }
  async get(k){ return this.m.has(k) ? this.m.get(k) : null; }
  async set(k,v,{ttlSeconds}={}){ this.m.set(k,v); if(ttlSeconds){ const t=setTimeout(()=>this.m.delete(k),ttlSeconds*1000); t.unref?.(); } }
  async delete(k){ this.m.delete(k); }
  async setIfAbsent(k,v,{ttlSeconds}={}){ if(this.m.has(k)) return false; await this.set(k,v,{ttlSeconds}); return true; }
  async increment(k,{ttlSeconds}={}){ const n=Number(this.m.get(k) ?? 0)+1; await this.set(k,n,{ttlSeconds}); return n; }
}

class MemoryAuthRepo {
  constructor({box,totpSecret}){ this.accounts = new Map(); this.sessions = new Map(); this.attempts=[]; this.setupRequired=true; this.box=box; this.totpSecret=totpSecret; this.challenges=new Map(); }
  async findAccountByEmail(email){ return [...this.accounts.values()].find(a=>a.email===email) ?? null; }
  async bootstrapSuperAdmin({email,passwordHash}){
    if(!this.setupRequired || [...this.accounts.values()].some(a=>a.framework_role==="super_admin")) return null;
    this.setupRequired=false;
    const a={account_id:"usr_e2e_admin",email,password_hash:passwordHash,status:"active",authority_domain:"framework",framework_role:"super_admin"};
    this.accounts.set(a.account_id,a); return {...a};
  }
  async findTotpMethod(accountId){ return this.accounts.has(accountId)?{account_id:accountId,secret_ciphertext:this.box.encrypt(this.totpSecret),verified_at:new Date()}:null; }
  async createMfaChallenge({accountId,tokenHash,expiresAt}){ const c={challenge_id:`mfc_${this.challenges.size+1}`,account_id:accountId,token_hash:tokenHash,expires_at:expiresAt,attempts:0,used_at:null};this.challenges.set(c.challenge_id,c);return c; }
  async findMfaChallenge(tokenHash){ const c=[...this.challenges.values()].find(x=>x.token_hash===tokenHash&&!x.used_at&&x.expires_at>Date.now());if(!c)return null;const a=this.accounts.get(c.account_id);return {...c,email:a.email,account_status:a.status,authority_domain:a.authority_domain,framework_role:a.framework_role,secret_ciphertext:this.box.encrypt(this.totpSecret)}; }
  async incrementMfaChallengeAttempts(id){ const c=this.challenges.get(id);if(c)c.attempts+=1; }
  async consumeRecoveryCode(){ return true; }
  async consumeMfaChallenge(id){ const c=this.challenges.get(id);if(!c||c.used_at||c.expires_at<=Date.now())return false;c.used_at=new Date();return true; }
  async createSession({accountId,tokenHash,expiresAt,ip,userAgent}){
    const s={session_id:`ses_${this.sessions.size+1}`,account_id:accountId,token_hash:tokenHash,expires_at:expiresAt,ip,user_agent:userAgent,revoked_at:null};
    this.sessions.set(s.session_id,s); return {session_id:s.session_id,account_id:accountId,expires_at:expiresAt};
  }
  async findSessionByTokenHash(hash){
    const s=[...this.sessions.values()].find(x=>x.token_hash===hash && !x.revoked_at && x.expires_at>Date.now());
    if(!s) return null; const a=this.accounts.get(s.account_id);
    return {session_id:s.session_id,account_id:a.account_id,email:a.email,account_status:a.status,authority_domain:a.authority_domain,framework_role:a.framework_role,expires_at:s.expires_at};
  }
  async touchSession(){ }
  async revokeSession(id,accountId){ const s=this.sessions.get(id); if(s && (!accountId || s.account_id===accountId)) s.revoked_at=new Date(); }
  async recordLoginAttempt(v){ this.attempts.push(v); }
}

class MemoryJobDatabase {
  constructor(){ this.rows=[]; }
  async query(sql,args=[]){
    if(sql.includes("INSERT INTO infrastructure.jobs")){
      this.rows.push({job_id:args[0],job_type:args[1],payload:JSON.parse(args[2]),status:"pending",attempts:0,max_attempts:args[3]});
      return {rows:[]};
    }
    if(sql.includes("status='completed'")){ const r=this.rows.find(x=>x.job_id===args[0]); if(r) r.status="completed"; return {rows:[]}; }
    if(sql.includes("status='failed'")){ const r=this.rows.find(x=>x.job_id===args[0]); if(r) r.status="failed"; return {rows:[]}; }
    if(sql.includes("RETURNING j.*")){
      const picked=this.rows.filter(x=>x.status==="pending").slice(0,args[0]);
      for(const r of picked){r.status="processing";r.attempts+=1;r.locked_by=args[1];}
      return {rows:picked.map(x=>({...x}))};
    }
    if(sql.includes("status='pending'")){ const r=this.rows.find(x=>x.job_id===args[0]); if(r) r.status="pending"; return {rows:[]}; }
    return {rows:[]};
  }
}

class MemoryOutbox {
  constructor(records=[]){ this.records=records; this.published=[]; this.failed=[]; }
  async claim(limit){ return this.records.splice(0,limit); }
  async markPublished(id){ this.published.push(id); }
  async markFailed(id,error){ this.failed.push({id,error}); }
}

const logger={info(){},error(){},fatal(){},warn(){},debug(){},child(){return this;}};

async function runMiddleware(mw, req){
  return new Promise((resolvePromise,reject)=>mw(req,{},err=>err?reject(err):resolvePromise()));
}

function normalizeManifest(raw){
  return {...raw,
    dependencies:{required:[],optional:[],...(raw.dependencies??{})},
    provides:raw.provides??[], permissions:raw.permissions??[],
    events:{publish:[],subscribe:[],...(raw.events??{})}, jobs:raw.jobs??[]
  };
}

test("E2E: core lifecycle authenticates admin, boots official modules, dispatches events/jobs, and shuts down", async () => {
  const cache=new MemoryCache();
  const box=new SecretBox(Buffer.alloc(32,9));
  const totpSecret="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const authRepo=new MemoryAuthRepo({box,totpSecret});
  const passwordHasher=new PasswordHasher();
  const tokens=new TokenService({pepper:"e2e-test-pepper-value-that-is-long-enough"});
  const rateLimiter=new RateLimiter({cache});
  const auth=new AuthService({repo:authRepo,passwordHasher,tokens,rateLimiter,loginRateLimit:5,loginRateWindowSeconds:60,totp:new TotpService(),secretBox:box});
  const adminAuthz=new AdminAuthorization();
  const events=new EventBus({logger});
  const jobRegistry=new JobRegistry();
  const jobDb=new MemoryJobDatabase();
  const jobs=new JobQueue({registry:jobRegistry,database:jobDb,logger,pollIntervalMs:999999});
  const themes=new ThemeRegistry();
  const features=new FeatureService({cache});
  const idempotency=new IdempotencyService({cache});

  const kernel=new Kernel({config:{},logger});
  await kernel.boot(async k=>{
    k.services.register("core.events",()=>events);
    k.services.register("core.jobRegistry",()=>jobRegistry);
    k.services.register("core.jobs",()=>jobs);
    k.capabilities.register("identity.authentication",auth,{owner:"core"});

    const modulesRoot=resolve(process.cwd(),"src/modules");
    const dirs=(await readdir(modulesRoot,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
    assert.equal(dirs.length,12,"all 12 official modules should ship in the distribution");
    for(const dir of dirs){
      const manifest=normalizeManifest(JSON.parse(await readFile(resolve(modulesRoot,dir,"module.manifest.json"),"utf8")));
      const impl=(await import(pathToFileURL(resolve(modulesRoot,dir,manifest.entry??"./index.js")))).default;
      const ctx=createModuleContext(k,manifest);
      await impl.register(ctx); await impl.boot?.(ctx);
      const health=await impl.health?.(ctx);
      assert.equal(health?.status,"healthy",`${manifest.id} should report healthy`);
    }
    themes.register({id:"framework.default",name:"Default",version:"0.3.1",status:"ACTIVE"});
    k.registerShutdownHook(()=>jobs.close());
  });
  assert.equal(kernel.state,"READY");

  // First install -> Super Admin -> login -> authenticated/admin-protected route.
  const admin=await auth.bootstrapSuperAdmin({email:"Admin@Example.com",password:"correct horse battery staple 2026",frameworkVersion:"0.3.1"});
  assert.equal(admin.framework_role,"super_admin");
  const second=await authRepo.bootstrapSuperAdmin({email:"other@example.com",passwordHash:"x"});
  assert.equal(second,null,"initial setup must be one-time");

  const passwordLogin=await auth.login({email:"admin@example.com",password:"correct horse battery staple 2026",ip:"127.0.0.1",userAgent:"e2e"});
  assert.equal(passwordLogin.mfa_required,true);
  const login=await auth.verifyMfa({challengeToken:passwordLogin.challenge_token,code:"RECOVERY-CODE",ip:"127.0.0.1",userAgent:"e2e"});
  assert.match(login.token,/^[A-Za-z0-9_-]+$/);
  const req={context:{},get(name){return name.toLowerCase()==="authorization"?`Bearer ${login.token}`:"";}};
  await runMiddleware(createAuthenticationMiddleware({auth}),req);
  await runMiddleware(createFrameworkAdminMiddleware({adminAuthz}),req);
  assert.equal(req.context.identity.framework_role,"super_admin");

  const protectedRoute=defineRoute({method:"GET",path:"/v1/e2e/admin",middleware:[createAuthenticationMiddleware({auth}),createFrameworkAdminMiddleware({adminAuthz})],handler:({context})=>({account_id:context.identity.account_id})});
  kernel.routes.register(protectedRoute);
  assert.ok(kernel.routes.list().some(r=>r.path==="/v1/e2e/admin"));

  // Every declared first-party capability should have been registered.
  const capabilityNames=new Set(kernel.capabilities.list().map(x=>x.name));
  for(const name of ["users.profile.read","access.permission.check","communication.email.send","communication.notification.send","commerce.payment.create","messaging.message.send","media.file.store","content.entity.manage","search.query","forms.schema.validate","workflow.transition.execute","automation.execute"]){
    assert.ok(capabilityNames.has(name),`missing capability ${name}`);
  }

  // Theme fallback + feature flags.
  assert.equal(themes.resolve("app_e2e").id,"framework.default");
  await features.set("app_e2e","new_dashboard",{enabled:true,tenants:["ten_1"]});
  assert.equal(await features.enabled("app_e2e","new_dashboard",{tenantId:"ten_1"}),true);
  assert.equal(await features.enabled("app_e2e","new_dashboard",{tenantId:"ten_2"}),false);

  // Idempotency should execute once and replay.
  let opCount=0;
  const r1=await idempotency.execute("e2e-key-0001",async()=>({n:++opCount}),{scope:"app_e2e",request:{x:1}});
  const r2=await idempotency.execute("e2e-key-0001",async()=>({n:++opCount}),{scope:"app_e2e",request:{x:1}});
  assert.deepEqual(r1,r2); assert.equal(opCount,1);

  // Outbox -> EventBus -> subscriber -> published marker.
  const delivered=[]; events.subscribe("e2e.domain.changed",e=>delivered.push(e.data.value));
  const outbox=new MemoryOutbox([{event_id:"evt_1",event_type:"e2e.domain.changed",attempts:1,payload:{id:"evt_1",type:"e2e.domain.changed",version:1,data:{value:42}}}]);
  const dispatcher=new OutboxDispatcher({outbox,events,logger});
  assert.equal(await dispatcher.drainOnce(),1);
  assert.deepEqual(delivered,[42]); assert.deepEqual(outbox.published,["evt_1"]); assert.equal(outbox.failed.length,0);

  // Durable job enqueue -> claim -> execute -> completed.
  let jobRuns=0; jobRegistry.register({id:"e2e.job",retries:2,timeoutMs:1000,handler:async payload=>{jobRuns+=payload.amount;}});
  const enqueued=await jobs.enqueue("e2e.job",{amount:3});
  assert.match(enqueued.id,/^job_/);
  assert.equal(await jobs.drainOnce(),1);
  assert.equal(jobRuns,3); assert.equal(jobDb.rows[0].status,"completed");

  await auth.logout(req.context.identity);
  assert.equal(await auth.authenticate(login.token),null,"logout must revoke the session");

  await kernel.shutdown();
  assert.equal(kernel.state,"STOPPED");
});
