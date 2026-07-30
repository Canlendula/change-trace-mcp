import assert from "node:assert/strict";
import test from "node:test";

import { getServiceStatus } from "../src/service-status.mjs";

test("preserves the operational result", () => {
  assert.deepEqual(getServiceStatus(), {
    state: "operational",
    message: "Service is operational.",
  });
});

test("reports maintenance when planned maintenance is active", () => {
  assert.deepEqual(getServiceStatus({ plannedMaintenance: true }), {
    state: "maintenance",
    message: "Scheduled maintenance is in progress.",
  });
});
