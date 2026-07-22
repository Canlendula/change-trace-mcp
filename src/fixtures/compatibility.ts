import { FIXTURE_SCHEMA_VERSION } from "../constants.js";

export type CompatibilityFixture = {
  schemaVersion: string;
  fixtureId: "m1-host-compatibility";
  ok: true;
  scalar: "change-trace";
  values: readonly [1, 2, 3];
  nested: {
    alpha: "A";
    beta: "B";
  };
};

export function createCompatibilityFixture(): CompatibilityFixture {
  return {
    schemaVersion: FIXTURE_SCHEMA_VERSION,
    fixtureId: "m1-host-compatibility",
    ok: true,
    scalar: "change-trace",
    values: [1, 2, 3],
    nested: {
      alpha: "A",
      beta: "B",
    },
  };
}

export function serializeCompatibilityFixture(
  fixture: CompatibilityFixture,
): string {
  return JSON.stringify(fixture);
}
