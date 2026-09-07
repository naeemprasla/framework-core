import { ErrorCodes } from "./error-codes.js";

export class AppError extends Error {
  constructor({ code = ErrorCodes.INTERNAL_ERROR, message = "Internal server error", status = 500, details = [], cause } = {}) {
    super(message, { cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = Array.isArray(details) ? details : [details];
    Error.captureStackTrace?.(this, AppError);
  }
}

export const isAppError = (error) => error instanceof AppError;
