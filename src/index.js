import { loadConfig } from "./core/config/env.js";
import { createLogger } from "./core/observability/logger.js";
import { Kernel } from "./core/kernel/kernel.js";
import { bootstrapCore } from "./bootstrap/bootstrap-core.js";
import { createApp } from "./app/create-app.js";
import { SetupTokenManager } from "./core/setup/setup-token-manager.js";
import { SetupService } from "./core/setup/setup-service.js";
import { createSetupApp } from "./setup-console/create-setup-app.js";
import { shouldAutoOpenSetup, openUrlInDefaultBrowser } from "./core/setup/setup-browser.js";
import { FRAMEWORK_VERSION } from "./core/version.js";

let server=null,kernel=null,setupService=null,shuttingDown=false;
async function listen(app,config,logger,label){return new Promise((resolve,reject)=>{const s=app.listen(config.port,config.host,()=>{logger.info({host:config.host,port:config.port,mode:label},"http_server_started");resolve(s);});s.once("error",reject);});}
async function startRuntime(){const config=loadConfig();if(config.installMode)throw new Error("Runtime infrastructure is not configured");const logger=createLogger({level:config.log.level,env:config.env});kernel=new Kernel({config,logger});await kernel.boot(bootstrapCore);server=await listen(createApp({kernel}),config,logger,"runtime");}
async function startInstaller(){const config=loadConfig();const logger=createLogger({level:config.log.level,env:config.env});const tokenManager=new SetupTokenManager();setupService=new SetupService({config,logger,frameworkVersion:FRAMEWORK_VERSION});const app=createSetupApp({config,tokenManager,setupService,onComplete:async()=>{try{await setupService.close();setupService=null;const old=server;server=null;await new Promise(r=>old.close(r));await startRuntime();}catch(error){logger.fatal({err:error},"setup_runtime_handoff_failed");}}});server=await listen(app,config,logger,"installer");const setupUrl=tokenManager.url(config.baseUrl);logger.warn({setup_url:setupUrl,expires_minutes:30},"initial_setup_required");if(shouldAutoOpenSetup({env:config.env,baseUrl:config.baseUrl,enabled:config.setup.autoOpen})){const opened=openUrlInDefaultBrowser(setupUrl);logger.info({setup_url:setupUrl,opened},opened?"setup_browser_open_requested":"setup_browser_open_unavailable");}}
async function start(){const config=loadConfig();if(config.installMode)return startInstaller();try{return await startRuntime();}catch(error){if(String(error?.message).includes("Framework setup is incomplete")){kernel=null;return startInstaller();}throw error;}}
async function shutdown(signal){if(shuttingDown)return;shuttingDown=true;const logger=kernel?.logger;logger?.info({signal},"shutdown_started");if(setupService)await setupService.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));if(kernel)await kernel.shutdown();logger?.info("shutdown_complete");}
process.on("SIGTERM",()=>shutdown("SIGTERM").finally(()=>process.exit(0)));process.on("SIGINT",()=>shutdown("SIGINT").finally(()=>process.exit(0)));
await start();
