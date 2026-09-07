import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { dirname, relative, resolve, isAbsolute } from "node:path";
export class LocalStorage {
  constructor({ root }) { this.root = resolve(root); }
  path(key) {
    if (typeof key !== "string" || !key || key.includes("\0")) throw new Error("Invalid storage key");
    const target = resolve(this.root, key);
    const rel = relative(this.root, target);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Invalid storage key");
    return target;
  }
  async put(key, data) { const target = this.path(key); await mkdir(dirname(target), { recursive: true, mode: 0o750 }); await writeFile(target, data, { mode: 0o640 }); return { key }; }
  async get(key) { return readFile(this.path(key)); }
  async delete(key) { await rm(this.path(key), { force: true }); }
}
