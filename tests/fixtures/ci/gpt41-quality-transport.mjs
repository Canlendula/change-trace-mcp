import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

function response(content) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

export async function createTransport() {
  const fixtureRoot = process.env.CHANGE_TRACE_GPT41_TEST_FIXTURES;
  const mode = process.env.CHANGE_TRACE_GPT41_TEST_MODE ?? "success";
  const observationPath = process.env.CHANGE_TRACE_GPT41_TEST_OBSERVATION;
  const calls = [];
  return async (request) => {
    const packet = JSON.parse(request.body.messages[0].content);
    calls.push({
      fixtureId: packet.fixtureId,
      model: request.body.model,
      stream: request.body.stream,
      maxTokens: request.body.max_tokens,
      responseFormatType: request.body.response_format?.type,
      hasTools: Object.hasOwn(request.body, "tools"),
      hasTokenInBody: JSON.stringify(request.body).includes("test-token-sentinel"),
    });
    if (observationPath) await writeFile(observationPath, JSON.stringify(calls));
    if (mode === "api_failure") throw new Error("api-body-sentinel");
    if (mode === "malformed") return response("raw-response-sentinel");
    if (mode === "rejected" && packet.fixtureId === "contradictory-documents") {
      return response(JSON.stringify({ schemaVersion: "1.0.0", fixtureId: packet.fixtureId, findings: ["raw-response-sentinel"] }));
    }
    if (mode === "mandatory_failure" && packet.fixtureId === "intentional-doc-free-refactor") {
      return response(JSON.stringify({ schemaVersion: "1.0.0", fixtureId: packet.fixtureId, findings: [{ raw: "raw-response-sentinel" }] }));
    }
    const findings = JSON.parse(await readFile(join(fixtureRoot, packet.fixtureId, "reference-findings.json"), "utf8"));
    return response(JSON.stringify({ schemaVersion: "1.0.0", fixtureId: packet.fixtureId, findings }));
  };
}
