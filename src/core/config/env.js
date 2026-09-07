import { z } from "zod";
import { RuntimeConfigStore } from "../setup/runtime-config-store.js";
import { requiresInstaller } from "./install-mode.js";

const boolString = z.string().default("false").transform(v => v === "true");
const intString = (defaultValue, min, max) => z.string().default(String(defaultValue)).transform(Number).pipe(z.number().int().min(min).max(max));
const optionalSecret = z.string().optional().transform(v => v?.trim() || null);
const optionalString = z.string().optional().transform(v => v?.trim() || null);
const schema = z.object({
  NODE_ENV:z.enum(["development","test","production"]).default("development"), HOST:z.string().default("0.0.0.0"), PORT:intString(3000,1,65535), APP_BASE_URL:z.url().default("http://localhost:3000"),
  DATABASE_URL:optionalString, DATABASE_POOL_MAX:intString(20,1,200), DATABASE_STATEMENT_TIMEOUT_MS:intString(5000,100,120000), DATABASE_IDLE_TIMEOUT_MS:intString(30000,1000,600000), DATABASE_CONNECTION_TIMEOUT_MS:intString(5000,100,60000),
  REDIS_URL:optionalString, LOG_LEVEL:z.enum(["fatal","error","warn","info","debug","trace","silent"]).default("info"), TRUST_PROXY:boolString, REQUEST_BODY_LIMIT:z.string().default("1mb"), CORS_ALLOWED_ORIGINS:z.string().default(""),
  AUTH_TOKEN_PEPPER:optionalSecret, SETUP_TOKEN:optionalSecret, SESSION_DAYS:intString(30,1,90), LOGIN_RATE_LIMIT:intString(10,1,1000), LOGIN_RATE_WINDOW_SECONDS:intString(900,10,86400), ALLOW_THIRD_PARTY_MODULES:boolString, AUTO_OPEN_SETUP:z.string().default("true").transform(v => v === "true")
});
export function loadConfig(env=process.env,{runtimeStore=new RuntimeConfigStore()}={}){
  let persisted={}; try{ persisted=runtimeStore.load(); }catch(error){ throw new Error(`Unable to decrypt persisted runtime configuration: ${error.message}`); }
  const source={...persisted,...env};
  const parsed=schema.safeParse(source); if(!parsed.success){const message=parsed.error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ");throw new Error(`Invalid environment configuration: ${message}`);}
  const e=parsed.data; const installMode=requiresInstaller({databaseUrl:e.DATABASE_URL});
  if(e.NODE_ENV==="production"){
    if(!e.APP_BASE_URL.startsWith("https://")) throw new Error("APP_BASE_URL must use HTTPS in production");
    if(!installMode && (!e.AUTH_TOKEN_PEPPER || e.AUTH_TOKEN_PEPPER.length<32)) throw new Error("AUTH_TOKEN_PEPPER must be at least 32 characters in production");
  }
  const allowedOrigins=e.CORS_ALLOWED_ORIGINS.split(",").map(v=>v.trim()).filter(Boolean);
  return Object.freeze({ env:e.NODE_ENV,host:e.HOST,port:e.PORT,baseUrl:e.APP_BASE_URL,installMode,
    database:{url:e.DATABASE_URL,poolMax:e.DATABASE_POOL_MAX,statementTimeoutMs:e.DATABASE_STATEMENT_TIMEOUT_MS,idleTimeoutMs:e.DATABASE_IDLE_TIMEOUT_MS,connectionTimeoutMs:e.DATABASE_CONNECTION_TIMEOUT_MS},
    redis:{url:e.REDIS_URL},log:{level:e.LOG_LEVEL},http:{trustProxy:e.TRUST_PROXY,bodyLimit:e.REQUEST_BODY_LIMIT,allowedOrigins},
    auth:{tokenPepper:e.AUTH_TOKEN_PEPPER,sessionDays:e.SESSION_DAYS,loginRateLimit:e.LOGIN_RATE_LIMIT,loginRateWindowSeconds:e.LOGIN_RATE_WINDOW_SECONDS},setup:{token:e.SETUP_TOKEN,autoOpen:e.AUTO_OPEN_SETUP},modules:{allowThirdParty:e.ALLOW_THIRD_PARTY_MODULES},runtimeStore });
}
