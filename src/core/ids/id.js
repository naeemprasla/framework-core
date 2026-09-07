import { randomBytes, randomUUID } from "node:crypto";

export function createPrefixedId(prefix) {
  if (!/^[a-z][a-z0-9_]{1,15}$/.test(prefix)) throw new TypeError("Invalid ID prefix");
  const entropy = randomBytes(12).toString("base64url");
  return `${prefix}_${entropy}`;
}

export function createRequestId() { return createPrefixedId("req"); }
export function createCorrelationId() { return createPrefixedId("cor"); }
export function createUuid() { return randomUUID(); }

export function newId(prefix) { return createPrefixedId(prefix); }
