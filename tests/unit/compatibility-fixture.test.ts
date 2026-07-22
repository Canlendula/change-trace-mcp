import { describe, expect, it } from "vitest";

import {
  createCompatibilityFixture,
  serializeCompatibilityFixture,
} from "../../src/fixtures/compatibility.js";

describe("compatibility fixture", () => {
  it("is reproducible and byte stable", () => {
    const first = serializeCompatibilityFixture(createCompatibilityFixture());
    const second = serializeCompatibilityFixture(createCompatibilityFixture());

    expect(first).toBe(second);
    expect(first).toBe(
      '{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}',
    );
  });
});
