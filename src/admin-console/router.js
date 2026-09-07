import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function createAdminConsoleRouter(){
  const router = express.Router();
  const root = resolve(here);

  router.use("/assets", express.static(resolve(root,"assets"), {
    fallthrough:false,
    etag:true,
    immutable:false,
    maxAge:"1h",
    index:false,
    setHeaders:(res,filePath)=>{
      if(filePath.endsWith(".css")) res.type("text/css; charset=utf-8");
      if(filePath.endsWith(".js")) res.type("text/javascript; charset=utf-8");
    }
  }));

  router.get("/", (_req,res)=>res.sendFile(resolve(root,"index.html"), { headers:{ "Cache-Control":"no-store" } }));
  router.get("/*path", (_req,res)=>res.sendFile(resolve(root,"index.html"), { headers:{ "Cache-Control":"no-store" } }));
  return router;
}
