const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const VARIABLE = /^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

export class TemplateEngine {
  compile(source) {
    if (typeof source !== "string") throw new TypeError("Template source must be a string");
    if (Buffer.byteLength(source, "utf8") > 1024 * 1024) throw new Error("Template exceeds maximum size");
    return context => source.replace(/{{\s*([^{}]+?)\s*}}/g, (_, rawPath) => {
      const path = rawPath.trim();
      if (!VARIABLE.test(path)) throw new Error(`Invalid template expression: ${path}`);
      const value = path.split(".").reduce((current, key) => current == null ? undefined : current[key], context);
      return escapeHtml(value);
    });
  }
  render(source, context = {}) { return this.compile(source)(context); }
}
