import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

export function createAuthenticationMiddleware({ auth, required = true }) {
  return async (req, _res, next) => {
    try {
      const header = req.get("authorization") ?? "";
      const match = /^Bearer\s+(.+)$/i.exec(header);
      const identity = match ? await auth.authenticate(match[1]) : null;
      if (!identity && required) throw new AppError({ code:ErrorCodes.UNAUTHORIZED, message:"Authentication required", status:401 });
      if (identity) {
        req.context.identity = identity;
        req.context.accountId = identity.account_id;
        req.context.sessionId = identity.session_id;
      }
      next();
    } catch (error) { next(error); }
  };
}

export function createFrameworkAdminMiddleware({ adminAuthz, superAdmin = false }) {
  return (req, _res, next) => {
    try { superAdmin ? adminAuthz.requireSuperAdmin(req.context?.identity) : adminAuthz.requireFrameworkAdmin(req.context?.identity); next(); }
    catch (error) { next(error); }
  };
}

function readCookie(req, name) {
  const raw = req.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) { try { return decodeURIComponent(rest.join("=")); } catch { return null; } }
  }
  return null;
}

export function createAdminSessionAuthenticationMiddleware({ auth, cookieName = "framework_admin_session", required = true }) {
  return async (req, _res, next) => {
    try {
      const token = readCookie(req, cookieName);
      const identity = token ? await auth.authenticate(token) : null;
      if (!identity && required) throw new AppError({ code:ErrorCodes.UNAUTHORIZED, message:"Authentication required", status:401 });
      if (identity) {
        req.context.identity = identity;
        req.context.accountId = identity.account_id;
        req.context.sessionId = identity.session_id;
      }
      next();
    } catch (error) { next(error); }
  };
}

export function createSameOriginMiddleware({ baseUrl }) {
  const expected = new URL(baseUrl).origin;
  return (req, _res, next) => {
    try {
      const origin = req.get("origin");
      const fetchSite = req.get("sec-fetch-site");
      if (origin && origin !== expected) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:"Cross-origin admin request rejected", status:403 });
      if (fetchSite && !["same-origin", "none"].includes(fetchSite)) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:"Cross-site admin request rejected", status:403 });
      next();
    } catch (error) { next(error); }
  };
}
