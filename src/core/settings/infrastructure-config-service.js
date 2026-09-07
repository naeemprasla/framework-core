import { RedisCache } from "../cache/redis-cache.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";
export class InfrastructureConfigService{
 constructor({config,logger,dashboardSettings}){Object.assign(this,{config,logger,dashboardSettings});}
 status(){const persisted=this.config.runtimeStore.load();return {cache:{provider:persisted.REDIS_URL?"redis":"local",redis_configured:Boolean(persisted.REDIS_URL)},postgres:{configured:Boolean(persisted.DATABASE_URL)}};}
 async configureRedis({url,actorId=null}){url=String(url??"").trim();if(!url){const persisted=this.config.runtimeStore.load();delete persisted.REDIS_URL;this.config.runtimeStore.save(persisted);await this.dashboardSettings.set({group:"infrastructure",key:"cache.provider",value:"local",actorId});return {provider:"local",restart_required:true};}if(!/^rediss?:\/\//i.test(url))throw new AppError({code:ErrorCodes.VALIDATION_FAILED,message:"Redis URL must use redis:// or rediss://",status:400});const redis=new RedisCache({url,logger:this.logger});try{await redis.connect();await redis.ping();}catch{throw new AppError({code:ErrorCodes.SERVICE_UNAVAILABLE,message:"Unable to connect to Redis",status:400});}finally{await redis.close().catch(()=>{});}const persisted=this.config.runtimeStore.load();persisted.REDIS_URL=url;this.config.runtimeStore.save(persisted);await this.dashboardSettings.set({group:"infrastructure",key:"cache.provider",value:"redis",actorId});return {provider:"redis",configured:true,restart_required:true};}
}
