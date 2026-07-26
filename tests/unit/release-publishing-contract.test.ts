import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function repositoryFile(path: string): Promise<string> {
  return await readFile(resolve(root, path), "utf8");
}

describe("M7 stage-only publishing contract", () => {
  it("keeps the workflow manual, pinned, credential-separated, and stage-guarded", async () => {
    const workflow = await repositoryFile(".github/workflows/npm-stage-publish.yml");
    expect(workflow).toContain("on:\n  workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(?:push|pull_request|schedule|workflow_call):/mu);
    expect(workflow).toContain("default: dry-run");
    expect(workflow).toContain("- dry-run");
    expect(workflow).toContain("- stage");
    expect(workflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
    expect(workflow).not.toMatch(/actions\/(?:checkout|setup-node)@v/iu);
    expect(workflow).toContain("node-version: 24.18.0");
    expect(workflow).toContain("npm@11.16.0");
    expect(workflow).toContain("npm ci --ignore-scripts --no-audit --no-fund --registry https://registry.npmjs.org/");
    expect(workflow).not.toMatch(/\bcache\s*:/iu);
    expect(workflow).not.toMatch(/(?:NODE_AUTH_TOKEN|NPM_TOKEN|npmrc|secrets?\.)/iu);

    const [dryRunSection, stageSection] = workflow.split("  stage:\n", 2);
    expect(dryRunSection).toContain("permissions:\n      contents: read");
    expect(dryRunSection).not.toContain("id-token: write");
    expect(stageSection).toContain("vars.NPM_STAGE_PUBLISH_ENABLED == 'true'");
    expect(stageSection).toContain("github.ref == format('refs/tags/v{0}', inputs.version)");
    expect(stageSection).toContain("environment: npm-stage");
    expect(stageSection).toContain("id-token: write");
    expect(stageSection).toContain("test \"$INPUT_CONFIRMATION\" = \"STAGE CHANGE-TRACE-MCP CANDIDATE\"");
    expect(stageSection).toContain("grep -Eq '^[0-9a-f]{40}$'");
    expect(stageSection).toContain("git rev-parse HEAD");
    expect(stageSection).toContain('git rev-parse "refs/tags/v$INPUT_VERSION^{}"');
    expect(stageSection).toContain('test "$INPUT_VERSION" != "0.0.0-dev.0"');
    expect(stageSection).toContain("npm stage publish --tag next --access public --ignore-scripts --registry https://registry.npmjs.org/");
    expect(stageSection).not.toMatch(/npm\s+publish\b|npm\s+dist-tag\b|npm\s+stage\s+(?:approve|reject)|git\s+tag|gh\s+release/iu);
  });

  it("uses a bounded, credential-free local helper plan", async () => {
    const helper = await repositoryFile("scripts/release/dry-run-publish.mjs");
    expect(helper).toContain("shell: false");
    expect(helper).toContain("credentialKey");
    expect(helper).toContain("npm_config_userconfig: locations.userConfig");
    expect(helper).toContain("npm_config_registry: registry");
    expect(helper).toContain("maxOutputBytes");
    expect(helper).toContain("command_output_overflow");
    expect(helper).toContain("command_timeout");
    expect(helper).toContain("await ensureRemoved(temporaryRoot)");
    expect(helper).toContain("npm publish --dry-run");
    expect(helper).toContain('"--tag", tag, "--access", "public"');
    expect(helper).toContain("version_already_published");
    expect(helper).toContain("tarball_count_invalid");
    expect(helper).toContain("pack_json_invalid");
  });

  it("documents manual authorization boundaries without asserting external release activity", async () => {
    const guide = await repositoryFile("docs/release/PUBLISHING.md");
    expect(guide).toContain("This is repository-maintainer guidance.");
    expect(guide).toContain("NPM_STAGE_PUBLISH_ENABLED=true");
    expect(guide).toContain("STAGE CHANGE-TRACE-MCP CANDIDATE");
    expect(guide).toContain("WebAuthn");
    expect(guide).toContain("latest");
    expect(guide).toContain("local-dry-run-only");
    expect(guide).toContain("https://docs.npmjs.com/trusted-publishers");
    expect(guide).not.toMatch(/this task (?:configured|staged|approved|published)/iu);
  });
});
