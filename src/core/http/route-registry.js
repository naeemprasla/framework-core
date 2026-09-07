import { asyncHandler } from "./async-handler.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";
export class RouteRegistry {
  #routes = []; #keys = new Set();
  register(route) {
    const key = `${route.method}:${route.path}`;
    if (this.#keys.has(key)) throw new AppError({ code:ErrorCodes.DUPLICATE_REGISTRATION, message:`Route already registered: ${key}`, status:500 });
    this.#keys.add(key); this.#routes.push(route); return route;
  }
  list() { return [...this.#routes]; }
  mount(router) {
    for (const route of this.#routes) router[route.method](route.path, ...route.middleware, asyncHandler(async (req, res) => {
      const result = await route.handler({ req, res, context:req.context, body:req.body, query:req.query, params:req.params });
      if (res.headersSent) return;
      if (result === undefined) return res.status(route.status).end();
      return res.status(route.status).json({ data:result, request_id:req.context?.requestId ?? null });
    }));
    return router;
  }
}
