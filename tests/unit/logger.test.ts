import { afterEach, describe, expect, it, vi } from "vitest";

import { writeLog } from "../../src/logger.js";

describe("protocol-safe logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes structured JSON to stderr only", () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    writeLog("info", "test_event", { fixture: true });

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledOnce();

    const line = String(stderr.mock.calls[0]?.[0]);
    const record = JSON.parse(line) as Record<string, unknown>;
    expect(record).toMatchObject({
      level: "info",
      event: "test_event",
      details: { fixture: true },
    });
    expect(line.endsWith("\n")).toBe(true);
  });
});
