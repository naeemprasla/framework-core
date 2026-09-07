import test from "node:test";
import assert from "node:assert/strict";
import { CapabilityRegistry } from "../src/core/capabilities/capability-registry.js";

test("registers and resolves a capability", () => {
  const registry = new CapabilityRegistry();
  const service = { run: () => true };
  registry.register("example.run", service);
  assert.equal(registry.require("example.run"), service);
  assert.equal(registry.list()[0].name, "example.run");
});
