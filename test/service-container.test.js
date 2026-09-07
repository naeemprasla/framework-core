import test from "node:test";
import assert from "node:assert/strict";
import { ServiceContainer } from "../src/core/container/service-container.js";

test("singleton service is created once", () => {
  const c = new ServiceContainer();
  let count = 0;
  c.register("x", () => ({ n: ++count }));
  assert.equal(c.resolve("x"), c.resolve("x"));
  assert.equal(count, 1);
});

test("transient service is recreated", () => {
  const c = new ServiceContainer();
  c.register("x", () => ({}), { lifetime: "transient" });
  assert.notEqual(c.resolve("x"), c.resolve("x"));
});
