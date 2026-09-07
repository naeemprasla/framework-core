import test from "node:test";
import assert from "node:assert/strict";
import { createPrefixedId } from "../src/core/ids/id.js";

test("creates opaque prefixed IDs", () => {
  const id = createPrefixedId("req");
  assert.match(id, /^req_[A-Za-z0-9_-]+$/);
});
