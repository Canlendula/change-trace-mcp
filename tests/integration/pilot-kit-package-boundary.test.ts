import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const require = createRequire(import.meta.url);
const npmCli = process.env.npm_execpath ?? require.resolve("npm/bin/npm-cli.js");
const pilotKitFiles = [
  "docs/pilot/README.md", "docs/pilot/PILOT_PLAN.md", "docs/pilot/FEEDBACK_FORM.md",
  "docs/pilot/pilot-observation.schema.json", "docs/pilot/fixtures/mechanics-baseline.json",
  "docs/pilot/fixtures/mechanics-summary.json", "scripts/pilot/summarize-pilot.mjs",
  "tests/unit/pilot-metrics.test.ts", "tests/integration/pilot-kit-package-boundary.test.ts",
];

describe("pilot kit package boundary", () => {
  it("keeps all repository-only pilot-kit entry points out of the npm tarball", async () => {
    const destination = await mkdtemp(join(tmpdir(), "change-trace-pilot-pack-"));
    try {
      const result = await execFileAsync(process.execPath, [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", destination], { cwd: root });
      const records = JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>;
      expect(records).toHaveLength(1);
      const files = new Set(records[0]?.files.map((file) => file.path.replaceAll("\\", "/")) ?? []);
      for (const path of pilotKitFiles) expect(files.has(path)).toBe(false);
      expect([...files].some((path) => path.startsWith("docs/pilot/") || path.startsWith("scripts/pilot/"))).toBe(false);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  }, 30_000);
});
