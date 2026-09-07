import { readFile, realpath } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { createModuleContext } from "./module-context.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

const manifestSchema = z.object({
  id:z.string().regex(/^[a-z][a-z0-9_.-]{2,127}$/),
  name:z.string().min(1).max(160),
  version:z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/),
  framework:z.object({ minimum:z.string().min(1), maximum:z.string().optional() }),
  dependencies:z.object({ required:z.array(z.string()).default([]), optional:z.array(z.string()).default([]) }).default({ required:[], optional:[] }),
  provides:z.array(z.string()).default([]),
  permissions:z.array(z.string()).default([]),
  events:z.object({ publish:z.array(z.string()).default([]), subscribe:z.array(z.string()).default([]) }).default({ publish:[], subscribe:[] }),
  jobs:z.array(z.string()).default([]),
  settings:z.array(z.object({
    key:z.string().regex(/^[a-z][a-z0-9_.-]{1,127}$/),
    label:z.string().min(1).max(120),
    type:z.enum(["string","number","boolean","select","secret"]).default("string"),
    required:z.boolean().default(false),
    default:z.any().optional(),
    options:z.array(z.union([z.string(),z.number(),z.boolean()])).optional(),
    description:z.string().max(500).optional()
  }).strict()).default([]),
  entry:z.string().default("./index.js")
}).strict();

function tuple(v) { const m=/^(\d+)\.(\d+)\.(\d+)/.exec(String(v)); return m ? m.slice(1).map(Number) : null; }
function compare(a,b){ const x=tuple(a),y=tuple(b); if(!x||!y)return null; for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i]; return 0; }
function compatible(current, range) {
  if (compare(current, range.minimum) < 0) return false;
  if (!range.maximum) return true;
  if (/^\d+\.x$/.test(range.maximum)) return tuple(current)[0] <= Number(range.maximum.split('.')[0]);
  return compare(current, range.maximum) <= 0;
}

export class ModuleManager {
  constructor({ kernel, registry, frameworkVersion = "0.3.0", allowThirdParty = false, trustedRoot=null, trustedRoots=[] }) { Object.assign(this, { kernel, registry, frameworkVersion, allowThirdParty }); this.trustedRoots=[...new Set([trustedRoot,...trustedRoots].filter(Boolean))]; this.installing=new Set(); }
  async loadManifest(path) {
    let raw; try { raw=JSON.parse(await readFile(path,"utf8")); } catch(cause) { throw new AppError({ code:ErrorCodes.INVALID_MODULE_MANIFEST, message:"Invalid module manifest", status:500, cause }); }
    const parsed=manifestSchema.safeParse(raw);
    if(!parsed.success) throw new AppError({ code:ErrorCodes.INVALID_MODULE_MANIFEST, message:"Invalid module manifest", status:500, details:parsed.error.issues.map(i=>({path:i.path.join("."),message:i.message})) });
    return parsed.data;
  }
  async discover(manifestPath) {
    const manifest=await this.loadManifest(manifestPath); const realManifest=await realpath(manifestPath); const roots=await Promise.all(this.trustedRoots.map(r=>realpath(r).catch(()=>null)));
    const builtIn=roots.some(root=>root && realManifest.startsWith(`${root}/`));
    if(!builtIn && !this.allowThirdParty) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:"Third-party modules are disabled", status:403 });
    if(!compatible(this.frameworkVersion,manifest.framework)) throw new AppError({ code:ErrorCodes.MODULE_INCOMPATIBLE, message:`Module ${manifest.id} is incompatible with framework ${this.frameworkVersion}`, status:500 });
    const rec={...manifest,manifestPath:realManifest,status:"AVAILABLE",trusted:builtIn}; this.registry.add(rec); return rec;
  }
  findProvider(capability){ return this.registry.list().find(r=>(r.provides??[]).includes(capability)) ?? null; }
  async ensureDependencies(rec) {
    for(const name of rec.dependencies.required){
      if(this.kernel.capabilities.has(name)) continue;
      const provider=this.findProvider(name);
      if(!provider) throw new AppError({ code:ErrorCodes.MODULE_DEPENDENCY_MISSING, message:`Module ${rec.id} requires capability ${name}`, status:500 });
      await this.install(provider.id);
      if(!this.kernel.capabilities.has(name)) throw new AppError({ code:ErrorCodes.MODULE_DEPENDENCY_MISSING, message:`Provider ${provider.id} did not register required capability ${name}`, status:500 });
    }
  }
  async install(id) {
    const rec=this.registry.get(id); if(!rec) throw new Error(`Unknown module: ${id}`);
    if(["INSTALLED","ENABLED"].includes(rec.status)) return rec;
    if(this.installing.has(id)) throw new AppError({ code:ErrorCodes.MODULE_DEPENDENCY_MISSING, message:`Circular module dependency detected at ${id}`, status:500 });
    if(rec.status!=="AVAILABLE") return rec;
    rec.status="INSTALLING"; this.installing.add(id);
    try {
      await this.ensureDependencies(rec);
      const base=await realpath(dirname(rec.manifestPath)); const entry=await realpath(resolve(base,rec.entry));
      if(!entry.startsWith(`${base}/`)) throw new AppError({ code:ErrorCodes.INVALID_MODULE_MANIFEST, message:"Module entry escapes package directory", status:500 });
      const mod=await import(pathToFileURL(entry)); const impl=mod.default??mod.moduleDefinition??mod;
      if(!impl||typeof impl!=="object") throw new AppError({ code:ErrorCodes.INVALID_MODULE_MANIFEST, message:"Module entry must export a module definition", status:500 });
      rec.impl=impl; await impl.register?.(createModuleContext(this.kernel,rec)); rec.status="INSTALLED"; return rec;
    } catch(error) { rec.status="INSTALL_FAILED"; throw error; }
    finally { this.installing.delete(id); }
  }
  async bootAll() {
    for(const rec of this.registry.list()) if(rec.status==="AVAILABLE") await this.install(rec.id);
    for(const rec of this.registry.list()) if(rec.status==="INSTALLED") {
      try { await rec.impl?.boot?.(createModuleContext(this.kernel,rec)); const health=await rec.impl?.health?.(createModuleContext(this.kernel,rec)); if(health?.status && health.status!=="healthy") throw new Error(`Module health is ${health.status}`); rec.status="ENABLED"; }
      catch(error){rec.status="HEALTH_CHECK_FAILED";throw error;}
    }
  }
}
