import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  collectChangeScope,
  DEFAULT_CHANGE_SCOPE_LIMITS,
} from "../../src/git/change-scope.js";
import { changeScopeSchema } from "../../src/schemas/change-scope.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

function fixtureDirectory(name: string): string {
  return fileURLToPath(new URL(`../fixtures/git/${name}`, import.meta.url));
}

async function collectFixture(name: string) {
  const fixture = await materializeGitFixture(fixtureDirectory(name));
  const scope = await collectChangeScope({
    repositoryPath: fixture.repositoryPath,
    baseRef: fixture.baseObjectId,
    headRef: fixture.headObjectId,
  });
  return { fixture, scope };
}

describe("collectChangeScope edge cases", () => {
  it("preserves both paths for a rename", async () => {
    const { fixture, scope } = await collectFixture("rename");

    try {
      expect(changeScopeSchema.parse(scope)).toEqual(scope);
      expect(scope.files).toHaveLength(1);
      expect(scope.files[0]).toMatchObject({
        status: "renamed",
        path: "src/new-name.ts",
        previousPath: "src/old-name.ts",
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("reports a deleted document", async () => {
    const { fixture, scope } = await collectFixture("deletion");

    try {
      expect(changeScopeSchema.parse(scope)).toEqual(scope);
      expect(scope.files).toHaveLength(1);
      expect(scope.files[0]).toMatchObject({
        status: "deleted",
        path: "docs/obsolete.md",
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("marks binary patches without returning binary content", async () => {
    const { fixture, scope } = await collectFixture("binary");

    try {
      expect(changeScopeSchema.parse(scope)).toEqual(scope);
      expect(scope.files).toHaveLength(1);
      expect(scope.files[0]).toMatchObject({
        path: "assets/fixture.bin",
        isBinary: true,
        additions: null,
        deletions: null,
        diff: null,
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("retains a deterministic gitlink patch for a submodule update", async () => {
    const { fixture, scope } = await collectFixture("submodule");

    try {
      expect(changeScopeSchema.parse(scope)).toEqual(scope);
      expect(scope.files).toHaveLength(1);
      expect(scope.files[0]).toMatchObject({
        status: "modified",
        path: "vendor/example",
        isBinary: false,
      });
      expect(scope.files[0]?.diff?.text).toContain(
        "Subproject commit 2222222222222222222222222222222222222222",
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("bounds an oversized text patch at the default per-file limit", async () => {
    const { fixture, scope } = await collectFixture("oversized");

    try {
      expect(changeScopeSchema.parse(scope)).toEqual(scope);
      expect(scope.files).toHaveLength(1);
      expect(scope.files[0]?.diff).toMatchObject({
        isTruncated: true,
        retainedBytes: DEFAULT_CHANGE_SCOPE_LIMITS.maxPatchBytesPerFile,
      });
      expect(scope.files[0]?.diff?.originalBytes).toBeGreaterThan(
        DEFAULT_CHANGE_SCOPE_LIMITS.maxPatchBytesPerFile,
      );
      expect(scope.truncation.reasons).toContain("per_file_diff_limit");
    } finally {
      await fixture.cleanup();
    }
  });
});
