import { PostgresDatabase } from "../core/database/postgres.js";
import { runMigrations } from "../core/database/migration-runner.js";
import { RedisCache } from "../core/cache/redis-cache.js";
import { LocalCache } from "../core/cache/local-cache.js";
import { FrameworkStateRepository } from "../core/framework-state/framework-state-repository.js";
import { FrameworkStateService } from "../core/framework-state/framework-state-service.js";
import { ApplicationRepository } from "../core/applications/application-repository.js";
import { ApplicationConfigService } from "../core/applications/application-config-service.js";
import { ApplicationModuleService } from "../core/applications/application-module-service.js";
import { TenantRepository } from "../core/tenants/tenant-repository.js";
import { defineRoute } from "../core/http/define-route.js";
import { PasswordHasher } from "../core/security/password-hasher.js";
import { TokenService } from "../core/security/token-service.js";
import { AuthRepository } from "../core/auth/auth-repository.js";
import { AuthService } from "../core/auth/auth-service.js";
import { createAuthenticationMiddleware, createFrameworkAdminMiddleware, createAdminSessionAuthenticationMiddleware, createSameOriginMiddleware } from "../core/auth/auth-middleware.js";
import { AdminAuthorization } from "../core/admin-auth/admin-authorization.js";
import { ProviderRegistry } from "../core/providers/provider-registry.js";
import { EventBus } from "../core/events/event-bus.js";
import { OutboxRepository } from "../core/events/outbox-repository.js";
import { OutboxDispatcher } from "../core/events/outbox-dispatcher.js";
import { JobRegistry } from "../core/jobs/job-registry.js";
import { JobQueue } from "../core/jobs/job-queue.js";
import { Scheduler } from "../core/scheduler/scheduler.js";
import { AuditService } from "../core/audit/audit-service.js";
import { SecretStore } from "../core/secrets/secret-store.js";
import { LocalStorage } from "../core/storage/local-storage.js";
import { RateLimiter } from "../core/rate-limit/rate-limiter.js";
import { FeatureService } from "../core/feature-flags/feature-service.js";
import { IdempotencyService } from "../core/idempotency/idempotency-service.js";
import { ModuleRegistry } from "../core/modules/module-registry.js";
import { ModuleManager } from "../core/modules/module-manager.js";
import { ThemeRegistry } from "../core/themes/theme-registry.js";
import { TemplateEngine } from "../core/themes/template-engine.js";
import { PackageRegistry } from "../core/packages/package-registry.js";
import { WebhookSigner } from "../core/webhooks/webhook-signer.js";
import { AdminUiRegistry } from "../core/admin-ui/admin-ui-registry.js";
import { ControlPlaneService } from "../core/admin-ui/control-plane-service.js";
import { DashboardSettingsService } from "../core/settings/dashboard-settings-service.js";
import { InfrastructureConfigService } from "../core/settings/infrastructure-config-service.js";
import { ModuleSettingsService } from "../core/modules/module-settings-service.js";
import { TotpService } from "../core/security/totp-service.js";
import { SecretBox } from "../core/security/secret-box.js";
import { dirname, resolve } from "node:path";
import { readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FRAMEWORK_VERSION } from "../core/version.js";

const here = dirname(fileURLToPath(import.meta.url));
const officialModules = ["users","access","email","notifications","billing","messaging","media","content","search","forms","workflow","automation"];

export async function bootstrapCore(kernel) {
  const { config, logger } = kernel;
  const database = new PostgresDatabase({ connectionString:config.database.url, max:config.database.poolMax, statementTimeoutMs:config.database.statementTimeoutMs, idleTimeoutMs:config.database.idleTimeoutMs, connectionTimeoutMs:config.database.connectionTimeoutMs, logger });
  await database.ping();
  kernel.registerShutdownHook(() => database.close());
  await runMigrations({ database, directory:resolve(here, "../core/database/migrations"), logger });
  const cache = config.redis.url
    ? new RedisCache({ url:config.redis.url, logger })
    : new LocalCache({ logger });
  await cache.connect();
  kernel.registerShutdownHook(() => cache.close());
  logger.info({ cache_mode:config.redis.url?"redis":"local" }, "cache_provider_ready");

  const stateService = new FrameworkStateService(new FrameworkStateRepository(database));
  const bootState = await stateService.getStatus();
  if (!bootState.initialized) throw new Error("Framework setup is incomplete; start in installer mode and complete /setup first");
  const applications = new ApplicationRepository(database); const tenants = new TenantRepository(database);
  const passwordHasher = new PasswordHasher(); const tokens = new TokenService({ pepper:config.auth.tokenPepper });
  const rateLimiter = new RateLimiter({ cache }); const authRepo = new AuthRepository(database);
  const totp = new TotpService();
  const secretBox = config.runtimeStore?.key ? new SecretBox(config.runtimeStore.key()) : null;
  const auth = new AuthService({ repo:authRepo, passwordHasher, tokens, rateLimiter, sessionDays:config.auth.sessionDays, loginRateLimit:config.auth.loginRateLimit, loginRateWindowSeconds:config.auth.loginRateWindowSeconds, totp, secretBox });
  const adminAuthz = new AdminAuthorization();
  const providers = new ProviderRegistry(); const events = new EventBus({ logger }); const outbox = new OutboxRepository(database);
  const jobRegistry = new JobRegistry(); const jobs = new JobQueue({ registry:jobRegistry, database, logger }); const scheduler = new Scheduler({ jobs, logger });
  const outboxDispatcher = new OutboxDispatcher({ outbox, events, logger });
  const audit = new AuditService(database); const secrets = new SecretStore({}); const storage = new LocalStorage({ root:resolve(process.cwd(), "var/storage") });
  const features = new FeatureService({ cache }); const idempotency = new IdempotencyService({ cache });
  const moduleRegistry = new ModuleRegistry();
  const moduleRoot = resolve(here, "../modules");
  const customModuleRoot = resolve(process.cwd(), "custom-modules");
  const moduleManager = new ModuleManager({ kernel, registry:moduleRegistry, frameworkVersion:FRAMEWORK_VERSION, allowThirdParty:config.modules.allowThirdParty, trustedRoots:[moduleRoot,customModuleRoot] });
  const themes = new ThemeRegistry(); const templates = new TemplateEngine(); const packages = new PackageRegistry(); const webhookSigner = new WebhookSigner();
  const adminUi = new AdminUiRegistry();
  const appConfig = new ApplicationConfigService({ database, tokens });
  const applicationModules = new ApplicationModuleService({ database, moduleRegistry });
  const dashboardSettings = new DashboardSettingsService({ database, secretBox });
  const moduleSettings = new ModuleSettingsService({ database, moduleRegistry, secretBox });
  const infrastructureConfig = new InfrastructureConfigService({ config, logger, dashboardSettings });
  const controlPlane = new ControlPlaneService({ database, health:kernel.health, moduleRegistry, themes, adminUi, frameworkVersion:FRAMEWORK_VERSION });

  const services = { database,cache,stateService,applications,appConfig,applicationModules,tenants,passwordHasher,tokens,auth,authRepo,providers,events,outbox,outboxDispatcher,jobRegistry,jobs,scheduler,audit,secrets,storage,rateLimiter,features,idempotency,moduleRegistry,moduleManager,moduleSettings,themes,templates,packages,webhookSigner,adminAuthz,adminUi,dashboardSettings,infrastructureConfig,controlPlane };
  for (const [name, service] of Object.entries(services)) kernel.services.register(`core.${name}`, () => service);

  kernel.capabilities.register("framework.state.read", stateService, { owner:"core" });
  kernel.capabilities.register("application.lookup", applications, { owner:"core" });
  kernel.capabilities.register("tenant.lookup", tenants, { owner:"core" });
  kernel.capabilities.register("identity.authentication", auth, { owner:"core" });
  kernel.capabilities.register("framework.audit.write", audit, { owner:"core" });
  kernel.capabilities.register("framework.admin.ui.register", adminUi, { owner:"core" });
  kernel.capabilities.register("framework.control_plane.read", controlPlane, { owner:"core" });

  kernel.health.register("postgres", () => database.ping(), { critical:true });
  if(config.redis.url) kernel.health.register("redis", () => cache.ping(), { critical:false });
  else kernel.health.register("local_cache", () => cache.ping(), { critical:false });

  const requireAuth = createAuthenticationMiddleware({ auth });
  const requireAdmin = createFrameworkAdminMiddleware({ adminAuthz });
  const requireAdminSession = createAdminSessionAuthenticationMiddleware({ auth });
  const requireSameOrigin = createSameOriginMiddleware({ baseUrl:config.baseUrl });
  const requireAdminCookie = [requireAdminSession, requireAdmin];
  const requireSuperAdminCookie = [requireAdminSession, createFrameworkAdminMiddleware({ adminAuthz, superAdmin:true })];
  const adminCookie = "framework_admin_session";

  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/auth/login", status:200, handler:({ req, body }) => auth.login({ email:body?.email, password:body?.password, ip:req.ip, userAgent:req.get("user-agent") }) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/auth/me", middleware:[requireAuth], handler:({ context }) => ({ account_id:context.identity.account_id, email:context.identity.email, authority_domain:context.identity.authority_domain, framework_role:context.identity.framework_role ?? null }) }));
  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/auth/logout", middleware:[requireAuth], status:204, handler:({ context }) => auth.logout(context.identity) }));

  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/status", middleware:[requireAuth, requireAdmin], handler:() => stateService.getStatus() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/modules", middleware:[requireAuth, requireAdmin], handler:() => moduleRegistry.list().map(({ impl, manifestPath, ...m }) => m) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/health", middleware:[requireAuth, requireAdmin], handler:() => kernel.health.run() }));

  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/admin/session", middleware:[requireSameOrigin], status:200, handler:async ({ req, res, body }) => {
    const result = await auth.login({ email:body?.email, password:body?.password, ip:req.ip, userAgent:req.get("user-agent") });
    adminAuthz.requireFrameworkAdmin(result.account);
    if (result.mfa_required) return { mfa_required:true, challenge_token:result.challenge_token, expires_at:result.expires_at, account:result.account };
    res.cookie(adminCookie, result.token, { httpOnly:true, sameSite:"strict", secure:config.env === "production", path:"/", maxAge:config.auth.sessionDays * 86400000 });
    return { account:result.account, expires_at:result.session.expires_at };
  } }));
  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/admin/session/mfa", middleware:[requireSameOrigin], status:200, handler:async ({ req, res, body }) => {
    const result = await auth.verifyMfa({ challengeToken:body?.challenge_token, code:body?.code, ip:req.ip, userAgent:req.get("user-agent") });
    adminAuthz.requireFrameworkAdmin(result.account);
    res.cookie(adminCookie, result.token, { httpOnly:true, sameSite:"strict", secure:config.env === "production", path:"/", maxAge:config.auth.sessionDays * 86400000 });
    return { account:result.account, expires_at:result.session.expires_at };
  } }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/session", middleware:requireAdminCookie, handler:({ context }) => ({ account_id:context.identity.account_id, email:context.identity.email, framework_role:context.identity.framework_role }) }));
  kernel.routes.register(defineRoute({ method:"DELETE", path:"/v1/admin/session", middleware:[requireSameOrigin, ...requireAdminCookie], status:204, handler:async ({ context, res }) => {
    await auth.logout(context.identity);
    res.clearCookie(adminCookie, { httpOnly:true, sameSite:"strict", secure:config.env === "production", path:"/" });
  } }));

  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/dashboard/overview", middleware:requireAdminCookie, handler:() => controlPlane.overview() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/applications", middleware:requireAdminCookie, handler:({ query }) => controlPlane.applications(query) }));
  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/admin/applications", middleware:[requireSameOrigin, ...requireSuperAdminCookie], status:201, handler:async ({ context, body }) => {
    const app = await controlPlane.createApplication({ name:body?.name, baseUrl:body?.base_url, tenantMode:body?.tenant_mode, deliveryMode:body?.delivery_mode });
    await audit.record({ action:"framework.application.created", actorId:context.identity.account_id, appId:app.app_id, targetType:"application", targetId:app.app_id, metadata:{ name:app.name } });
    return app;
  } }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/modules", middleware:requireAdminCookie, handler:() => controlPlane.modules() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/themes", middleware:requireAdminCookie, handler:() => controlPlane.themesList() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/operations", middleware:requireAdminCookie, handler:() => controlPlane.operations() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/audit", middleware:requireAdminCookie, handler:({ query }) => controlPlane.audit(query?.limit) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/security", middleware:requireAdminCookie, handler:() => controlPlane.securitySummary() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/security/mfa", middleware:requireAdminCookie, handler:({context})=>auth.mfaStatus(context.identity.account_id) }));
  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/admin/security/mfa/enroll", middleware:[requireSameOrigin,...requireAdminCookie], handler:({context})=>auth.beginMfaEnrollment(context.identity) }));
  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/admin/security/mfa/verify", middleware:[requireSameOrigin,...requireAdminCookie], handler:({context,body})=>auth.completeMfaEnrollment({account:context.identity,enrollmentToken:body?.enrollment_token,code:body?.code}) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/navigation", middleware:requireAdminCookie, handler:() => controlPlane.navigation() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/applications/:appId", middleware:requireAdminCookie, handler:({ params }) => appConfig.get(params.appId) }));
  kernel.routes.register(defineRoute({ method:"PATCH", path:"/v1/admin/applications/:appId", middleware:[requireSameOrigin, ...requireSuperAdminCookie], handler:({ params,body,context }) => appConfig.update(params.appId,body||{},context.identity.account_id) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/applications/:appId/modules", middleware:requireAdminCookie, handler:({params})=>applicationModules.list(params.appId) }));
  kernel.routes.register(defineRoute({ method:"PUT", path:"/v1/admin/applications/:appId/modules/:moduleId", middleware:[requireSameOrigin,...requireSuperAdminCookie], handler:({params,body,context})=>applicationModules.setEnabled(params.appId,params.moduleId,Boolean(body?.enabled),context.identity.account_id) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/applications/:appId/api-keys", middleware:requireAdminCookie, handler:({params})=>appConfig.listApiKeys(params.appId) }));
  kernel.routes.register(defineRoute({ method:"POST", path:"/v1/admin/applications/:appId/api-keys", middleware:[requireSameOrigin,...requireSuperAdminCookie], status:201, handler:({params,body,context})=>appConfig.createApiKey({appId:params.appId,name:body?.name,scopes:Array.isArray(body?.scopes)?body.scopes:[],actorId:context.identity.account_id}) }));
  kernel.routes.register(defineRoute({ method:"DELETE", path:"/v1/admin/applications/:appId/api-keys/:credentialId", middleware:[requireSameOrigin,...requireSuperAdminCookie], handler:({params,context})=>appConfig.revokeApiKey(params.appId,params.credentialId,context.identity.account_id) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/modules/:moduleId/settings", middleware:requireAdminCookie, handler:({params,query})=>moduleSettings.read(query.app_id,params.moduleId) }));
  kernel.routes.register(defineRoute({ method:"PUT", path:"/v1/admin/modules/:moduleId/settings", middleware:[requireSameOrigin,...requireSuperAdminCookie], handler:({params,body,context})=>moduleSettings.update(body?.app_id,params.moduleId,body?.values||{},context.identity.account_id) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/infrastructure", middleware:requireAdminCookie, handler:()=>infrastructureConfig.status() }));
  kernel.routes.register(defineRoute({ method:"PUT", path:"/v1/admin/infrastructure/redis", middleware:[requireSameOrigin,...requireSuperAdminCookie], handler:({body,context})=>infrastructureConfig.configureRedis({url:body?.url,actorId:context.identity.account_id}) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/framework/settings", middleware:requireAdminCookie, handler:()=>controlPlane.frameworkSettings() }));
  kernel.routes.register(defineRoute({ method:"PATCH", path:"/v1/admin/framework/settings", middleware:[requireSameOrigin,...requireSuperAdminCookie], handler:({body,context})=>controlPlane.updateFrameworkSettings(body||{},context.identity.account_id) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/admin/settings/:group", middleware:requireAdminCookie, handler:({params})=>dashboardSettings.list(params.group) }));
  kernel.routes.register(defineRoute({ method:"PUT", path:"/v1/admin/settings/:group/:key", middleware:[requireSameOrigin,...requireSuperAdminCookie], handler:({params,body,context})=>dashboardSettings.set({group:params.group,key:params.key,value:body?.value,secret:Boolean(body?.secret),actorId:context.identity.account_id}) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/control-plane/overview", middleware:[requireAuth, requireAdmin], handler:() => controlPlane.overview() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/control-plane/applications", middleware:[requireAuth, requireAdmin], handler:() => controlPlane.applications() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/control-plane/modules", middleware:[requireAuth, requireAdmin], handler:() => controlPlane.modules() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/control-plane/themes", middleware:[requireAuth, requireAdmin], handler:() => controlPlane.themesList() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/control-plane/operations", middleware:[requireAuth, requireAdmin], handler:() => controlPlane.operations() }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/control-plane/audit", middleware:[requireAuth, requireAdmin], handler:({ query }) => controlPlane.audit(query?.limit) }));
  kernel.routes.register(defineRoute({ method:"GET", path:"/v1/framework/control-plane/navigation", middleware:[requireAuth, requireAdmin], handler:() => controlPlane.navigation() }));

  for (const item of [
    {id:"core.overview",label:"Overview",href:"/admin/overview",area:"overview",order:10},
    {id:"core.applications",label:"Applications",href:"/admin/applications",area:"applications",order:10},
    {id:"core.modules",label:"Modules",href:"/admin/modules",area:"extensions",order:10},
    {id:"core.themes",label:"Themes",href:"/admin/themes",area:"extensions",order:20},
    {id:"core.operations",label:"Operations",href:"/admin/operations",area:"operations",order:10},
    {id:"core.developers",label:"Developer Tools",href:"/admin/developers",area:"developers",order:10},
    {id:"core.security",label:"Security & Audit",href:"/admin/security",area:"security",order:10},
    {id:"core.framework",label:"Framework",href:"/admin/framework",area:"framework",order:10}
  ]) adminUi.register(item);

  themes.register({ id:"framework.default", name:"Framework Default", version:FRAMEWORK_VERSION, status:"ACTIVE" });
  for (const id of officialModules) await moduleManager.discover(resolve(moduleRoot, `${id}/module.manifest.json`));
  try {
    for (const entry of await readdir(customModuleRoot,{withFileTypes:true})) {
      if (!entry.isDirectory()) continue;
      const manifest=resolve(customModuleRoot,entry.name,"module.manifest.json");
      try { await access(manifest); await moduleManager.discover(manifest); }
      catch(error){ logger.warn({module_directory:entry.name,err:error},"custom_module_discovery_skipped"); }
    }
  } catch(error){ if(error?.code!=="ENOENT") logger.warn({err:error},"custom_module_directory_scan_failed"); }
  await moduleManager.bootAll();
  jobs.start();
  outboxDispatcher.start();

  kernel.registerShutdownHook(() => outboxDispatcher.close());
  kernel.registerShutdownHook(() => jobs.close());
  kernel.registerShutdownHook(() => scheduler.close());
}
