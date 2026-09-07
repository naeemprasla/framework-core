import { AppError } from "../errors/app-error.js";
import { ErrorCodes } from "../errors/error-codes.js";

const AREAS = new Set(["overview","applications","extensions","operations","data","developers","observability","security","governance","framework"]);

function normalize(entry) {
  if (!entry || typeof entry !== "object") throw new TypeError("Admin UI contribution must be an object");
  const id = String(entry.id ?? "").trim();
  const label = String(entry.label ?? "").trim();
  const href = String(entry.href ?? "").trim();
  const area = String(entry.area ?? "extensions").trim();
  if (!/^[a-z][a-z0-9_.-]{2,127}$/.test(id)) throw new TypeError("Invalid admin UI contribution id");
  if (!label || label.length > 80) throw new TypeError("Invalid admin UI contribution label");
  if (!href.startsWith("/admin") || href.startsWith("//")) throw new TypeError("Admin UI href must remain under /admin");
  if (!AREAS.has(area)) throw new TypeError(`Unsupported admin UI area: ${area}`);
  return Object.freeze({ id, label, href, area, order:Number.isFinite(entry.order) ? entry.order : 100, permission:entry.permission ?? null, moduleId:entry.moduleId ?? null });
}

export class AdminUiRegistry {
  #items = new Map();
  register(entry) {
    const item = normalize(entry);
    if (this.#items.has(item.id)) throw new AppError({ code:ErrorCodes.DUPLICATE_REGISTRATION, message:`Admin UI item already registered: ${item.id}`, status:500 });
    this.#items.set(item.id,item); return item;
  }
  registerForModule(moduleId, entry) {
    const id=String(entry?.id ?? "");
    if (!id.startsWith(`${moduleId}.`)) throw new AppError({ code:ErrorCodes.FORBIDDEN, message:"Module admin UI item must use the module namespace", status:500 });
    return this.register({ ...entry, moduleId });
  }
  list() { return [...this.#items.values()].sort((a,b)=>a.area.localeCompare(b.area)||a.order-b.order||a.label.localeCompare(b.label)); }
}
