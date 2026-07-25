const ADAPTER = {
  id: "adapter:m5-jira-confluence-fixture",
  name: "M5 Jira and Confluence fixture",
  version: "1.0.0",
};

const RESULTS = {
  "request:jira-issue": {
    accessStatus: "available",
    title: "TRACE-42 acceptance criteria",
    sourceUpdatedAt: "2026-07-25T10:15:00.000Z",
    retrievedAt: "2026-07-26T11:05:00.000Z",
    excerpt: "The release must retain traceable evidence sources.",
  },
  "request:confluence-page": {
    accessStatus: "available",
    title: "Release evidence design",
    sourceUpdatedAt: "2026-07-25T10:30:00.000Z",
    retrievedAt: "2026-07-26T11:06:00.000Z",
    excerpt: "The linked page defines the final report provenance catalog.",
  },
  "request:confluence-comment": {
    accessStatus: "permission_denied",
    retrievedAt: "2026-07-26T11:07:00.000Z",
    message:
      "Comment access denied. access_token=confluence-permission-secret-sentinel",
  },
};

async function readRequest() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return JSON.parse(input);
}

const request = await readRequest();
const expectedRequestIds = [
  "request:jira-issue",
  "request:confluence-page",
  "request:confluence-comment",
];
if (
  request?.schemaVersion !== "1.0.0" ||
  request?.adapterId !== ADAPTER.id ||
  !Array.isArray(request?.references) ||
  request.references.length !== expectedRequestIds.length ||
  request.references.some(
    (reference, index) => reference?.requestId !== expectedRequestIds[index],
  )
) {
  process.exitCode = 2;
} else {
  process.stdout.write(
    JSON.stringify({
      schemaVersion: request.schemaVersion,
      adapter: ADAPTER,
      results: request.references.map((reference) => {
        const fixture = RESULTS[reference.requestId];
        if (fixture.accessStatus === "available") {
          return {
            accessStatus: fixture.accessStatus,
            requestId: reference.requestId,
            sourceType: reference.sourceType,
            source: reference.source,
            title: fixture.title,
            sourceUpdatedAt: fixture.sourceUpdatedAt,
            retrievedAt: fixture.retrievedAt,
            excerpt: fixture.excerpt,
            truncation: {
              isTruncated: false,
              originalCharacters: fixture.excerpt.length,
              retainedCharacters: fixture.excerpt.length,
            },
          };
        }
        return {
          accessStatus: fixture.accessStatus,
          requestId: reference.requestId,
          sourceType: reference.sourceType,
          source: reference.source,
          retrievedAt: fixture.retrievedAt,
          message: fixture.message,
        };
      }),
    }),
  );
}
