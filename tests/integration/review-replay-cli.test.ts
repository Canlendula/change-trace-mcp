import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const reviewRoot = fileURLToPath(new URL("../fixtures/review", import.meta.url));
const cliPath = fileURLToPath(new URL("../evaluation/review-replay-cli.ts", import.meta.url));

async function temporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
  });
}

describe("review replay CLI", () => {
  it("prepares deterministic confined prompt output and rejects non-empty targets", async () => {
    const root = await temporaryDirectory("change-trace-replay-cli-");
    const output = join(root, "prepared");
    try {
      await runCli(["prepare", "--fixtures", reviewRoot, "--output", output]);
      const manifest = await readFile(join(output, "manifest.json"), "utf8");
      const prompt = await readFile(join(output, "prompts", "implemented-correctly.json"), "utf8");
      expect(JSON.parse(manifest).packets).toHaveLength(9);
      expect(JSON.parse(prompt).fixtureId).toBe("implemented-correctly");

      await expect(runCli(["prepare", "--fixtures", reviewRoot, "--output", output])).rejects.toMatchObject({
        stderr: expect.stringMatching(/must be empty/),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("scores an exact capture set and safely rejects output and capture path hazards", async () => {
    const root = await temporaryDirectory("change-trace-replay-cli-score-");
    const prepared = join(root, "prepared");
    const captures = join(root, "captures");
    const output = join(root, "score");
    try {
      await runCli(["prepare", "--fixtures", reviewRoot, "--output", prepared]);
      await mkdir(captures);
      for (const name of ["implemented-correctly", "intentional-doc-free-refactor", "malicious-instruction"]) {
        await writeFile(join(captures, `${name}.json`), '{"schemaVersion":"1.0.0","fixtureId":"' + name + '","findings":[]}\n', "utf8");
      }
      for (const name of ["requirement-missing", "undocumented-behavior", "contradictory-documents", "missing-permissions", "stale-documentation", "insufficient-evidence"]) {
        const reference = await readFile(join(reviewRoot, name, "reference-findings.json"), "utf8");
        await writeFile(join(captures, `${name}.json`), '{"schemaVersion":"1.0.0","fixtureId":"' + name + '","findings":' + reference.trim() + "}\n", "utf8");
      }
      await runCli(["score", "--fixtures", reviewRoot, "--captures", captures, "--host-id", "test-host", "--host-version", "1", "--model", "model", "--output", output]);
      expect(JSON.parse(await readFile(join(output, "score.json"), "utf8")).suiteScore.passed).toBe(true);
      expect(await readFile(join(output, "summary.md"), "utf8")).toContain("Suite: PASS");

      const unsafe = join(root, "unsafe-output");
      await symlink(output, unsafe, "junction");
      await expect(runCli(["prepare", "--fixtures", reviewRoot, "--output", unsafe])).rejects.toMatchObject({ stderr: expect.stringMatching(/symbolic link/) });

      const failedOutput = join(root, "failed-score");
      await writeFile(
        join(captures, "requirement-missing.json"),
        '{"schemaVersion":"1.0.0","fixtureId":"requirement-missing","findings":[]}\n',
        "utf8",
      );
      await expect(runCli(["score", "--fixtures", reviewRoot, "--captures", captures, "--host-id", "test-host", "--host-version", "1", "--model", "model", "--output", failedOutput])).rejects.toMatchObject({
        stderr: expect.stringMatching(/suite failed/),
      });
      expect(JSON.parse(await readFile(join(failedOutput, "score.json"), "utf8")).suiteScore.passed).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
