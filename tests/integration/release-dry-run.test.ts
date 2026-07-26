import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const npmCli = process.env.npm_execpath ?? "npm";

describe("release dry-run packaging boundary", () => {
  it("keeps workflow, release guidance, helper, and release tests repository-only", async () => {
    const destination = await mkdtemp(join(tmpdir(), "change-trace-release-pack-"));
    try {
      const result = await execFileAsync(process.execPath, [npmCli, "pack", "--json", "--pack-destination", destination], { cwd: root });
      const records = JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>;
      expect(records).toHaveLength(1);
      const packedPaths = records[0]?.files.map(({ path }) => path.replaceAll("\\", "/")) ?? [];
      expect(packedPaths.some((path) => path === "docs/release/PUBLISHING.md" || path === "scripts/release/dry-run-publish.mjs" || path.startsWith(".github/") || path.startsWith("tests/"))).toBe(false);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  }, 30_000);
});
