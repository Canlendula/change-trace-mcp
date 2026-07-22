export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  details: Record<string, unknown>;
}

/**
 * Write structured operational logs to stderr so stdout stays reserved for
 * MCP JSON-RPC traffic.
 */
export function writeLog(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
): void {
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    event,
    details,
  };

  process.stderr.write(`${JSON.stringify(record)}\n`);
}
