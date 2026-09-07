import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

export class CapabilityRegistry {
  #capabilities = new Map();

  register(name, implementation, { version = 1, replace = false, owner = "core" } = {}) {
    if (!name || implementation == null) throw new TypeError("Capability name and implementation are required");
    if (this.#capabilities.has(name) && !replace) {
      throw new AppError({ code: ErrorCodes.DUPLICATE_REGISTRATION, message: `Capability already registered: ${name}`, status: 500 });
    }
    this.#capabilities.set(name, { name, implementation, version, owner });
    return this;
  }

  has(name) { return this.#capabilities.has(name); }
  get(name) { return this.#capabilities.get(name) ?? null; }
  require(name) {
    const item = this.get(name);
    if (!item) throw new AppError({ code: ErrorCodes.CAPABILITY_NOT_FOUND, message: `Required capability unavailable: ${name}`, status: 500 });
    return item.implementation;
  }
  list() { return [...this.#capabilities.values()].map(({ implementation, ...meta }) => meta); }
}
