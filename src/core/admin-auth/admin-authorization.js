import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";
export class AdminAuthorization {
  requireFrameworkAdmin(identity) {
    if (!identity || identity.authority_domain !== "framework" || !["super_admin", "admin"].includes(identity.framework_role)) {
      throw new AppError({ code: ErrorCodes.FORBIDDEN, message: "Framework administrator required", status: 403 });
    }
    return true;
  }
  requireSuperAdmin(identity) {
    if (!identity || identity.authority_domain !== "framework" || identity.framework_role !== "super_admin") {
      throw new AppError({ code: ErrorCodes.FORBIDDEN, message: "Framework Super Admin required", status: 403 });
    }
    return true;
  }
}
