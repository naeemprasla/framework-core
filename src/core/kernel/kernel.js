import { ServiceContainer } from "../container/service-container.js";
import { CapabilityRegistry } from "../capabilities/capability-registry.js";
import { RouteRegistry } from "../http/route-registry.js";
import { HealthRegistry } from "../health/health-registry.js";
export class Kernel {
  constructor({config,logger}) { this.config=config;this.logger=logger;this.services=new ServiceContainer();this.capabilities=new CapabilityRegistry();this.routes=new RouteRegistry();this.health=new HealthRegistry();this.state="CREATED";this.shutdownHooks=[]; }
  registerShutdownHook(fn){if(typeof fn!=="function")throw new TypeError("Shutdown hook must be a function");this.shutdownHooks.push(fn);}
  async boot(bootstrap){
    if(this.state!=="CREATED")throw new Error(`Kernel cannot boot from state ${this.state}`);
    this.state="BOOTING";
    try { await bootstrap(this); this.state="READY"; this.logger.info({kernel_state:this.state},"kernel_ready"); return this; }
    catch(error){ this.state="FAILED"; this.logger.fatal({err:error,kernel_state:this.state},"kernel_boot_failed"); await this.#runShutdownHooks(); throw error; }
  }
  async #runShutdownHooks(){for(const hook of [...this.shutdownHooks].reverse()){try{await hook();}catch(err){this.logger.error({err},"shutdown_hook_failed");}}this.shutdownHooks=[];}
  async shutdown(){if(this.state==="STOPPED")return;this.state="STOPPING";await this.#runShutdownHooks();this.state="STOPPED";}
}
