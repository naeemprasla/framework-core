const METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

export function defineRoute({ method, path, handler, middleware = [], status = 200, id = null }) {
  const normalizedMethod = String(method).toLowerCase();
  if (!METHODS.has(normalizedMethod)) throw new TypeError(`Unsupported HTTP method: ${method}`);
  if (typeof path !== "string" || !path.startsWith("/")) throw new TypeError("Route path must start with /");
  if (typeof handler !== "function") throw new TypeError("Route handler is required");
  if (!Array.isArray(middleware) || middleware.some(m => typeof m !== "function")) throw new TypeError("Route middleware must be functions");
  return Object.freeze({ id, method: normalizedMethod, path, handler, middleware, status });
}
