import { randomBytes } from "node:crypto";
import { PostgresDatabase } from "../database/postgres.js";
import { runMigrations } from "../database/migration-runner.js";
import { PasswordHasher } from "../security/password-hasher.js";
import { FrameworkSetupRepository } from "./framework-setup-repository.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here=dirname(fileURLToPath(import.meta.url));

import { createPostgresConnectionUrl, createSupabaseDirectUrl } from "./database-connection-policy.js";

export class SetupService {
  constructor({config,logger,frameworkVersion="0.6.3"}){this.config=config;this.logger=logger;this.frameworkVersion=frameworkVersion;this.store=config.runtimeStore;this.passwordHasher=new PasswordHasher();this.database=null;this.repo=null;this.serverType=this.store.load().SERVER_TYPE||"local";this.application=null;}
  systemCheck(){return {node:{ok:Number(process.versions.node.split('.')[0])>=22,value:process.versions.node},crypto:{ok:true},filesystem:{ok:true},framework_version:this.frameworkVersion};}
  setServerType(type){type=String(type||"").toLowerCase();if(!["local","live"].includes(type))throw new Error("Choose local or live server setup");this.serverType=type;const persisted=this.store.load();this.store.save({...persisted,SERVER_TYPE:type});return {server_type:type,requires_https:type==="live"};}
  async configureDatabase(input){
    const provider=String(input.provider||"supabase").toLowerCase();
    if(!["supabase","postgresql"].includes(provider))throw new Error("Unsupported database provider");
    let databaseUrl;
    if(provider==="supabase"){
      databaseUrl=createSupabaseDirectUrl(input);
    }else{
      databaseUrl=createPostgresConnectionUrl(input);
    }
    const db=new PostgresDatabase({connectionString:databaseUrl,max:this.config.database.poolMax,statementTimeoutMs:this.config.database.statementTimeoutMs,idleTimeoutMs:this.config.database.idleTimeoutMs,connectionTimeoutMs:this.config.database.connectionTimeoutMs,logger:this.logger});
    try{await db.ping();await runMigrations({database:db,directory:resolve(here,"../database/migrations"),logger:this.logger});}
    catch(error){await db.close().catch(()=>{});this.logger?.warn?.({err:error,provider},"setup_database_connection_failed");throw new Error(provider==="supabase"?"Unable to connect to Supabase Direct Database. Check the direct connection string, password, SSL and server IPv6 connectivity.":"Unable to connect to PostgreSQL or run migrations");}
    await this.close();this.database=db;this.repo=new FrameworkSetupRepository(db);const existing=this.store.load();
    this.store.save({...existing,DATABASE_URL:databaseUrl,DATABASE_PROVIDER:provider,AUTH_TOKEN_PEPPER:existing.AUTH_TOKEN_PEPPER||randomBytes(48).toString("base64url")});
    return {postgres:true,migrations:true,provider,direct_connection:provider==="supabase"};
  }
  ensureReady(){if(!this.repo)throw new Error("Database setup must be completed first");}
  async saveApplicationInfo(input){this.ensureReady();const name=String(input.application_name??"").trim();if(name.length<2||name.length>160)throw new Error("Application name must be 2-160 characters");let baseUrl=String(input.application_url||this.config.baseUrl);let parsed;try{parsed=new URL(baseUrl);}catch{throw new Error("Application URL is invalid");}if(!["http:","https:"].includes(parsed.protocol))throw new Error("Application URL must use HTTP(S)");if(this.serverType==="live"&&parsed.protocol!=="https:")throw new Error("Live server application URL must use HTTPS");const delivery=String(input.delivery_mode||"fullstack").toLowerCase();if(!["fullstack","headless","hybrid"].includes(delivery))throw new Error("Invalid application delivery mode");await this.repo.saveSettings({frameworkName:name,applicationName:name,publicUrl:parsed.toString(),adminUrl:new URL('/admin',parsed).toString(),locale:String(input.locale||"en").slice(0,16),timezone:String(input.timezone||"UTC").slice(0,64),serverType:this.serverType});const persisted=this.store.load();this.store.save({...persisted,APP_BASE_URL:parsed.origin,NODE_ENV:this.serverType==="live"?"production":"development",SERVER_TYPE:this.serverType});this.application=await this.repo.createInitialApplication({name,baseUrl:parsed.toString(),deliveryMode:delivery});return this.application;}
  async createSuperAdmin({email,password,fullName=null}){this.ensureReady();email=String(email??"").trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw new Error("Invalid email address");fullName=String(fullName??"").trim();if(fullName.length<2||fullName.length>120)throw new Error("Full name must be 2-120 characters");const passwordHash=await this.passwordHasher.hash(password);const account=await this.repo.createInitialAdmin({email,passwordHash,fullName});if(!account)throw new Error("Initial setup is locked");const finalized=await this.repo.finalize({frameworkVersion:this.frameworkVersion});if(!finalized)throw new Error("Unable to finalize setup");return {...account,initialized:true};}
  async close(){if(this.database){await this.database.close().catch(()=>{});this.database=null;}this.repo=null;}
}
