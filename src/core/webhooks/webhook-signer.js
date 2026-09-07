import { createHmac, timingSafeEqual } from "node:crypto";
export class WebhookSigner {
  sign(secret, payload, { timestamp = null } = {}) {
    if (typeof secret !== "string" || secret.length < 16) throw new Error("Webhook secret is too short");
    const body = timestamp == null ? String(payload) : `${timestamp}.${payload}`;
    return createHmac("sha256", secret).update(body).digest("hex");
  }
  verify(secret, payload, signature, { timestamp = null, toleranceSeconds = 300, now = Date.now() } = {}) {
    if (timestamp != null) {
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || Math.abs(Math.floor(now / 1000) - ts) > toleranceSeconds) return false;
    }
    let expected;
    try { expected = this.sign(secret, payload, { timestamp }); } catch { return false; }
    const a = Buffer.from(expected, "utf8"); const b = Buffer.from(String(signature ?? ""), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
