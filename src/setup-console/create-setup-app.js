import express from "express";
import helmet from "helmet";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
function cookie(req,name){for(const part of String(req.get("cookie")||"").split(";")){const [k,...v]=part.trim().split("=");if(k===name)return decodeURIComponent(v.join("="));}return null;}
export function createSetupApp({config,tokenManager,setupService,onComplete}){
  const app=express();if(config.http?.trustProxy)app.set("trust proxy",1);app.disable("x-powered-by");app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"]}}}));app.use(express.json({limit:"64kb",strict:true}));
  const sameOrigin=(req,res,next)=>{const origin=req.get("origin");const site=req.get("sec-fetch-site");const expected=`${req.protocol}://${req.get("host")}`;if(origin&&origin!==expected)return res.status(403).json({error:{code:"forbidden",message:"Cross-origin setup request rejected"}});if(site&&!['same-origin','none'].includes(site))return res.status(403).json({error:{code:"forbidden",message:"Cross-site setup request rejected"}});next();};
  const requireSetup=(req,res,next)=>{if(!tokenManager.validateSession(cookie(req,"framework_setup_session")))return res.status(404).json({error:{code:"setup_locked",message:"Setup is unavailable"}});next();};
  app.get("/health/live",(_req,res)=>res.json({status:"installer"}));
  app.use("/setup/assets",express.static(resolve(here,"assets"),{fallthrough:false,immutable:false,maxAge:"1h",index:false,setHeaders:(res,filePath)=>{if(filePath.endsWith(".css"))res.type("text/css; charset=utf-8");if(filePath.endsWith(".js"))res.type("text/javascript; charset=utf-8");}}));
  app.get("/setup",(req,res)=>{const query=req.originalUrl.includes("?")?req.originalUrl.slice(req.originalUrl.indexOf("?")):"";res.redirect(308,`/setup/${query}`);});
  app.get("/setup/",(_req,res)=>{res.set("Cache-Control","no-store");res.sendFile(resolve(here,"index.html"));});
  app.post("/v1/setup/session",sameOrigin,(req,res)=>{const session=tokenManager.exchange(req.body?.token);if(!session)return res.status(404).json({error:{code:"invalid_setup_token",message:"Setup link is invalid or expired"}});res.cookie("framework_setup_session",session,{httpOnly:true,sameSite:"strict",secure:req.secure||config.env==="production",path:"/",maxAge:30*60*1000});res.json({data:{authorized:true}});});
  app.get("/v1/setup/system",requireSetup,(_req,res)=>res.json({data:setupService.systemCheck()}));
  app.post("/v1/setup/server",sameOrigin,requireSetup,(req,res,next)=>{try{res.json({data:setupService.setServerType(req.body?.server_type)});}catch(e){next(e);}});
  app.post("/v1/setup/database",sameOrigin,requireSetup,async(req,res,next)=>{try{res.json({data:await setupService.configureDatabase(req.body||{})});}catch(e){next(e);}});
  app.post("/v1/setup/application",sameOrigin,requireSetup,async(req,res,next)=>{try{res.json({data:await setupService.saveApplicationInfo(req.body||{})});}catch(e){next(e);}});
  app.post("/v1/setup/admin",sameOrigin,requireSetup,async(req,res,next)=>{try{const result=await setupService.createSuperAdmin({email:req.body?.email,password:req.body?.password,fullName:req.body?.full_name});tokenManager.invalidate();res.clearCookie("framework_setup_session",{httpOnly:true,sameSite:"strict",secure:req.secure||config.env==="production",path:"/"});res.status(201).json({data:result});setTimeout(()=>onComplete?.(),250).unref?.();}catch(e){next(e);}});
  app.use((_req,res)=>res.status(404).json({error:{code:"not_found",message:"Not found"}}));
  app.use((err,_req,res,_next)=>{config.env!=="test"&&console.error("setup_error",err?.message);res.status(400).json({error:{code:"setup_failed",message:String(err?.message||"Setup failed").slice(0,300)}});});
  return app;
}
