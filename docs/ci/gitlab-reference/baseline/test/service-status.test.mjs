import assert from "node:assert/strict";
import test from "node:test";

import { getServiceStatus } from "../src/service-status.mjs";

test("reports the operational state", () => {
  assert.deepEqual(getServiceStatus(), {
    state: "operational",
    message: "Service is operational.",
  });
});
