import pino from "pino";

export function createLogger({ level = "info", env = "development" } = {}) {
  return pino({
    level,
    base: { service: "framework-core", env },
    redact: {
      paths: [
        "req.headers.authorization", "req.headers.cookie", "authorization", "cookie",
        "password", "password_hash", "token", "token_hash", "secret", "setup_token",
        "*.password", "*.password_hash", "*.token", "*.token_hash", "*.secret",
        "headers.authorization", "headers.cookie"
      ],
      censor: "[REDACTED]"
    },
    timestamp: pino.stdTimeFunctions.isoTime
  });
}
