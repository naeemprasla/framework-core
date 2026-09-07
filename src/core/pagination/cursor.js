export function encodeCursor(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try { return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); }
  catch { throw new Error("Invalid cursor"); }
}
export function clampLimit(value, { defaultLimit=25, maxLimit=100 }={}) {
  const n=Number(value ?? defaultLimit); return Number.isFinite(n) ? Math.max(1, Math.min(maxLimit, Math.trunc(n))) : defaultLimit;
}
