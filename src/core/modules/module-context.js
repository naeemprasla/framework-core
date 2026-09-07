import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

function allowedDependencies(moduleRecord) {
  return new Set([...(moduleRecord.dependencies?.required ?? []), ...(moduleRecord.dependencies?.optional ?? [])]);
}
function capabilityView(registry, moduleRecord) {
  const deps = allowedDependencies(moduleRecord); const provides = new Set(moduleRecord.provides ?? []);
  return Object.freeze({
    has: name => deps.has(name) && registry.has(name),
    require: name => {
      if (!deps.has(name)) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:`Module ${moduleRecord.id} did not declare capability dependency ${name}`, status:500 });
      return registry.require(name);
    },
    register: (name, implementation, options = {}) => {
      if (!provides.has(name)) throw new AppError({ code:ErrorCodes.INVALID_MODULE_MANIFEST, message:`Module ${moduleRecord.id} attempted to register undeclared capability ${name}`, status:500 });
      return registry.register(name, implementation, { ...options, owner:moduleRecord.id });
    }
  });
}
function eventView(events, moduleRecord) {
  const publish = new Set(moduleRecord.events?.publish ?? []); const subscribe = new Set(moduleRecord.events?.subscribe ?? []);
  return Object.freeze({
    publish: event => {
      if (!publish.has(event?.type)) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:`Module ${moduleRecord.id} cannot publish undeclared event ${event?.type}`, status:500 });
      return events.publish(event);
    },
    subscribe: (type, handler) => {
      if (!subscribe.has(type) && !subscribe.has("*")) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:`Module ${moduleRecord.id} cannot subscribe to undeclared event ${type}`, status:500 });
      return events.subscribe(type, handler);
    }
  });
}
function jobView(registry, moduleRecord) {
  const declared = new Set(moduleRecord.jobs ?? []);
  return Object.freeze({
    register: def => {
      if (!declared.has(def?.id)) throw new AppError({ code:ErrorCodes.INVALID_MODULE_MANIFEST, message:`Module ${moduleRecord.id} attempted to register undeclared job ${def?.id}`, status:500 });
      return registry.register(def);
    }
  });
}

function adminUiView(registry, moduleRecord) {
  return Object.freeze({
    registerPage: entry => registry.registerForModule(moduleRecord.id, entry)
  });
}

export function createModuleContext(kernel, moduleRecord) {
  const events = kernel.services.has("core.events") ? kernel.services.resolve("core.events") : null;
  const jobs = kernel.services.has("core.jobRegistry") ? kernel.services.resolve("core.jobRegistry") : null;
  const adminUi = kernel.services.has("core.adminUi") ? kernel.services.resolve("core.adminUi") : null;
  const settings = kernel.services.has("core.moduleSettings") ? kernel.services.resolve("core.moduleSettings") : null;
  const appModules = kernel.services.has("core.applicationModules") ? kernel.services.resolve("core.applicationModules") : null;
  return Object.freeze({
    module:Object.freeze({ id:moduleRecord.id, name:moduleRecord.name, version:moduleRecord.version }),
    capabilities:capabilityView(kernel.capabilities, moduleRecord),
    routes:Object.freeze({ register:route => kernel.routes.register(appModules ? { ...route, middleware:[appModules.middleware(moduleRecord.id), ...(route.middleware??[])] } : route) }),
    health:Object.freeze({ register:(name, check, options) => {
      if (name !== `module:${moduleRecord.id}` && !name.startsWith(`module:${moduleRecord.id}:`)) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:"Module health-check name must be namespaced", status:500 });
      return kernel.health.register(name, check, options);
    }}),
    events:events ? eventView(events, moduleRecord) : null,
    jobs:jobs ? jobView(jobs, moduleRecord) : null,
    admin:adminUi ? adminUiView(adminUi, moduleRecord) : null,
    adminUi:adminUi ? Object.freeze({ register:item => adminUi.registerForModule(moduleRecord.id,item) }) : null,
    settings:settings ? Object.freeze({ schema:()=>settings.schema(moduleRecord.id), read:appId=>settings.read(appId,moduleRecord.id), update:(appId,values,actorId=null)=>settings.update(appId,moduleRecord.id,values,actorId) }) : null,
    logger:kernel.logger.child({ module_id:moduleRecord.id })
  });
}
