import { describe, expect, it, vi } from "vitest";
import {
  createExecutionScope,
  raceWithSignal,
  throwIfAborted,
} from "@/utils/execution.js";
import { AuditAbortedError, AuditTimeoutError } from "@/errors.js";

describe("execution control", () => {
  it("propagates caller cancellation as a typed error", () => {
    const controller = new AbortController();
    const scope = createExecutionScope({
      parentSignal: controller.signal,
      phase: "crawl",
      url: "https://example.com",
    });

    controller.abort(new Error("cancelled by caller"));

    expect(() =>
      throwIfAborted(scope.signal, "crawl", "https://example.com"),
    ).toThrow(AuditAbortedError);
    scope.dispose();
  });

  it("enforces phase deadlines with timeout details", async () => {
    const scope = createExecutionScope({
      timeout: 10,
      phase: "rules",
      url: "https://example.com",
    });

    try {
      await expect(
        raceWithSignal(
          new Promise(() => undefined),
          scope.signal,
          "rules",
          "https://example.com",
        ),
      ).rejects.toBeInstanceOf(AuditTimeoutError);
      expect(scope.signal.reason).toMatchObject({
        code: "TIMEOUT",
        phase: "rules",
        details: { timeoutMs: 10, timeoutKind: "phase" },
      });
    } finally {
      scope.dispose();
    }
  });

  it("removes parent abort listeners when disposed", () => {
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const scope = createExecutionScope({
      parentSignal: controller.signal,
      phase: "crawl",
    });

    scope.dispose();

    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
