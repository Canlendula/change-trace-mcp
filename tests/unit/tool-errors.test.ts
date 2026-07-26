import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { operationFailed } from "../../src/tool-errors.js";

describe("safe top-level tool errors", () => {
  it.each([
    "get_change_scope_failed",
    "collect_local_evidence_failed",
    "get_review_bundle_failed",
    "validate_findings_failed",
    "write_report_failed",
  ])("returns the exact safe envelope for %s", (error) => {
    expect(operationFailed(error)).toEqual({
      content: [{ type: "text", text: JSON.stringify({ error, code: "operation_failed" }) }],
      isError: true,
    });
  });

  it("wires exactly the five affected server handlers to the safe helper without raw exception projection", async () => {
    const source = await readFile(
      fileURLToPath(new URL("../../src/server.ts", import.meta.url)),
      "utf8",
    );

    for (const error of [
      "get_change_scope_failed",
      "collect_local_evidence_failed",
      "get_review_bundle_failed",
      "validate_findings_failed",
      "write_report_failed",
    ]) {
      expect(source).toContain(`return operationFailed(\"${error}\");`);
    }
    expect(source.match(/return operationFailed\(/gu)).toHaveLength(5);
    expect(source).not.toMatch(/\berror\.message\b/u);
    expect(source).not.toContain("String(error)");
  });
});
