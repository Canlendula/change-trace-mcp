export type RedactionRecord = {
  kind: "secret" | "personal_data" | "policy" | "other";
  count: number;
  note: string | null;
};

export function redactCommonSecrets(content: string): {
  content: string;
  redactions: RedactionRecord[];
} {
  let count = 0;
  let redacted = content.replace(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gu,
    (match) => {
      count += 1;
      const newlineCount = match.split("\n").length - 1;
      return `[REDACTED PRIVATE KEY]${"\n".repeat(newlineCount)}`;
    },
  );
  redacted = redacted.replace(
    /(\b(?:api[_-]?key|access[_-]?token|password|secret)\b\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s"'`]+)/giu,
    (_match, prefix: string) => {
      count += 1;
      return `${prefix}[REDACTED]`;
    },
  );
  redacted = redacted.replace(
    /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,})\b/gu,
    () => {
      count += 1;
      return "[REDACTED TOKEN]";
    },
  );

  return {
    content: redacted,
    redactions:
      count === 0
        ? []
        : [
            {
              kind: "secret",
              count,
              note: "Common credential patterns were removed from the excerpt.",
            },
          ],
  };
}
