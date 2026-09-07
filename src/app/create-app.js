import express from "express";
import helmet from "helmet";
import cors from "cors";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requestContextMiddleware } from "../core/http/request-context.js";
import { createApplicationContextMiddleware } from "../core/applications/application-context-middleware.js";
import { notFoundMiddleware, createErrorMiddleware } from "../core/errors/error-middleware.js";
import { createAdminConsoleRouter } from "../admin-console/router.js";
const here = dirname(fileURLToPath(import.meta.url));
const adminRoot = resolve(here, "../admin-console");
export function createApp({ kernel }) {
  const app = express();
  if (kernel.config.http.trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy:{ policy:"same-site" } }));
  app.use(express.json({ limit:kernel.config.http.bodyLimit, strict:true, type:["application/json","application/*+json"] }));
  app.use(requestContextMiddleware);
  const applications=kernel.services.resolve("core.applications");
  const appConfig=kernel.services.resolve("core.appConfig");
  app.use(createApplicationContextMiddleware({applications,appConfig}));
  const globallyAllowed = new Set(kernel.config.http.allowedOrigins);
  app.use(cors((req,callback)=>callback(null,{
    origin(origin,done){if(!origin)return done(null,false);const appAllowed=new Set(req.context?.application?.cors_allowed_origins??[]);return done(null,globallyAllowed.has(origin)||appAllowed.has(origin));},
    credentials:false,methods:["GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"],allowedHeaders:["content-type","authorization","x-application-id","x-request-id","x-correlation-id","idempotency-key"]
  })));
  app.get("/health/live", (_req, res) => res.json({ status:"alive" }));
  app.use("/admin/assets", express.static(resolve(adminRoot, "assets"), { fallthrough:false, immutable:true, maxAge:"1h", etag:true }));
  app.get(["/admin", "/admin/", "/admin/*path"], (_req, res) => { res.set("Cache-Control", "no-store"); res.sendFile(resolve(adminRoot, "index.html")); });
  app.get("/health/ready", async (_req, res) => { const health = await kernel.health.run(); res.status(health.status === "ready" ? 200 : 503).json({ status:health.status }); });
  app.use("/admin", createAdminConsoleRouter());
  kernel.routes.mount(app);
  app.use(notFoundMiddleware);app.use(createErrorMiddleware({ logger:kernel.logger }));return app;
}
