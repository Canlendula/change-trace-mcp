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
const requiredCiFiles = [
  "docs/ci/README.md",
  "docs/ci/github-actions.example.yml",
  "docs/ci/gitlab-ci.example.yml",
  "docs/ci/portable-advisory.sh.example",
  "docs/ci/fixtures/deterministic-advisory-host.mjs",
  "scripts/ci/advisory-runner.mjs",
  "scripts/ci/summarize-advisory-status.mjs",
];

describe("packaged CI surface", () => {
  it("includes exactly the public CI runner, summarizer, examples, and fixture without workflows or provider helpers", async () => {
    const destination = await mkdtemp(join(tmpdir(), "change-trace-packaged-ci-"));
    try {
      const result = await execFileAsync(process.execPath, [npmCli, "pack", "--json", "--pack-destination", destination], { cwd: root });
      const records = JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>;
      expect(records).toHaveLength(1);
      const files = records[0]?.files.map((file) => file.path.replaceAll("\\", "/")) ?? [];
      expect(files).toEqual(expect.arrayContaining(requiredCiFiles));
      expect(files.filter((file) => file.startsWith("scripts/ci/"))).toEqual([
        "scripts/ci/advisory-runner.mjs",
        "scripts/ci/summarize-advisory-status.mjs",
      ]);
      expect(files.some((file) => file.startsWith(".github/workflows/") || file.startsWith("tests/"))).toBe(false);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  }, 30_000);
});
