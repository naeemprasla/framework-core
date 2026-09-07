import { AsyncLocalStorage } from "node:async_hooks";
import { createCorrelationId, createRequestId } from "../ids/id.js";

const storage = new AsyncLocalStorage();
const SAFE_EXTERNAL_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const safeHeaderId = (value, fallback) => typeof value === "string" && SAFE_EXTERNAL_ID.test(value) ? value : fallback();

export function requestContextMiddleware(req, res, next) {
  const requestId = safeHeaderId(req.get("x-request-id"), createRequestId);
  const correlationId = safeHeaderId(req.get("x-correlation-id"), createCorrelationId);
  const context = { requestId, correlationId, appId: null, tenantId: null, accountId: null, sessionId: null, identity: null };
  req.context = context;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);
  storage.run(context, next);
}

export function getRequestContext() { return storage.getStore() ?? null; }
