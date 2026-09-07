import { AppError, isAppError } from "./app-error.js";
import { ErrorCodes } from "./error-codes.js";
export function notFoundMiddleware(_req, _res, next) { next(new AppError({ code:ErrorCodes.NOT_FOUND, message:"Route not found", status:404 })); }
export function createErrorMiddleware({ logger }) {
  return (error, req, res, _next) => {
    if (res.headersSent) return;
    const safe = isAppError(error) ? error : new AppError({ code:ErrorCodes.INTERNAL_ERROR, message:"Internal server error", status:500, cause:error });
    logger.error({ err:error, request_id:req.context?.requestId, correlation_id:req.context?.correlationId, app_id:req.context?.appId, tenant_id:req.context?.tenantId }, "request_failed");
    const details = safe.status >= 500 ? [] : safe.details;
    res.status(safe.status).json({ error:{ code:safe.code, message:safe.message, request_id:req.context?.requestId ?? null, details } });
  };
}
