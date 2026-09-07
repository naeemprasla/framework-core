import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

export class ServiceContainer {
  #definitions = new Map();
  #singletons = new Map();

  register(name, factory, { lifetime = "singleton", replace = false } = {}) {
    if (!name || typeof factory !== "function") throw new TypeError("Service name and factory are required");
    if (this.#definitions.has(name) && !replace) {
      throw new AppError({ code: ErrorCodes.DUPLICATE_REGISTRATION, message: `Service already registered: ${name}`, status: 500 });
    }
    this.#definitions.set(name, { factory, lifetime });
    if (replace) this.#singletons.delete(name);
    return this;
  }

  has(name) { return this.#definitions.has(name); }

  resolve(name, scope = {}) {
    const definition = this.#definitions.get(name);
    if (!definition) {
      throw new AppError({ code: ErrorCodes.SERVICE_NOT_FOUND, message: `Service not found: ${name}`, status: 500 });
    }
    if (definition.lifetime === "singleton") {
      if (!this.#singletons.has(name)) this.#singletons.set(name, definition.factory({ container: this, scope }));
      return this.#singletons.get(name);
    }
    return definition.factory({ container: this, scope });
  }
}
