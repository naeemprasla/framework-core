import test from "node:test";
import assert from "node:assert/strict";
import { defineRoute } from "../src/core/http/define-route.js";

test("normalizes and freezes route definitions", () => {
  const route = defineRoute({ method: "GET", path: "/x", handler: () => null });
  assert.equal(route.method, "get");
  assert.ok(Object.isFrozen(route));
});
