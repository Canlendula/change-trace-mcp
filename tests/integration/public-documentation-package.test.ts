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
const smokeModulePath = "../../scripts/smoke-clean-install.mjs";
const publicFiles = [
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "docs/VERSIONING.md",
  "docs/external-adapters/AUTHORING.md",
  "docs/runtime-evidence/CONVERTER_AUTHORING.md",
];

describe("public documentation package surface", () => {
  it("packages the frozen guidance and keeps README navigation resolvable", async () => {
    const { validatePublicDocumentationLinks } = await import(smokeModulePath);
    await expect(validatePublicDocumentationLinks(root)).resolves.toMatchObject({ sources: 8 });
    const destination = await mkdtemp(join(tmpdir(), "change-trace-public-docs-pack-"));
    try {
      const result = await execFileAsync(process.execPath, [npmCli, "pack", "--json", "--pack-destination", destination], { cwd: root });
      const records = JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>;
      expect(records).toHaveLength(1);
      const files = records[0]?.files.map((file) => file.path.replaceAll("\\", "/")) ?? [];
      expect(files).toEqual(expect.arrayContaining(publicFiles));
      expect(files.some((file) => file === "AGENTS.md" || file === "docs/CONTRIBUTING_WORKFLOW.md" || file.startsWith("docs/work-items/"))).toBe(false);
    } finally {
      await rm(destination, { recursive: true, force: true });
    }
  }, 30_000);
});
