import { describe, expect, it } from "vitest";
import { buildFailureEvent, buildSuccessEvent } from "@/telemetry/event.js";
import { Source } from "@/telemetry/constants.js";
import { makeAuditReport } from "../../helpers/factories.js";
import { ConfigError, AuditTimeoutError, AuditAbortedError } from "@/errors.js";

const DENYLIST_SUBSTRINGS = [
  "url",
  "selector",
  "html",
  "screenshot",
  "accessiblename",
  "ip",
  "fingerprint",
];

function assertNoDeniedKeys(event: Record<string, unknown>): void {
  for (const key of Object.keys(event)) {
    const lower = key.toLowerCase();
    for (const denied of DENYLIST_SUBSTRINGS) {
      expect(lower.includes(denied)).toBe(false);
    }
  }
}

const envelope = {
  source: Source.Cli,
  machineId: "hashed-machine-id-value",
  isInternalUsage: false,
};

describe("call-home event payload", () => {
  it("builds only allow-listed, non-PII fields on success", () => {
    const report = makeAuditReport({
      url: "https://secret-internal-tool.example.com/admin?token=abc123",
      rules: [
        {
          ruleId: "keyboard-trap",
          passed: false,
          status: "failed",
          violations: [
            {
              ruleId: "keyboard-trap",
              ruleName: "Keyboard Trap",
              severity: "error",
              message: "Focus trapped in <div class='secret-widget'>",
              elements: [{ selector: "#secret-selector", tabPosition: 1 }],
            },
          ],
          duration: 5,
        },
      ],
      summary: {
        totalErrors: 1,
        totalWarnings: 0,
        totalInfo: 0,
        passed: 8,
        failed: 1,
        errors: 0,
        score: 89,
        scoreComplete: true,
      },
    });

    const event = buildSuccessEvent(report, envelope);

    // No URL, HTML, selector, accessible name, screenshot, report, IP, or
    // raw hardware fingerprint — only categorical/aggregate fields plus the
    // approved machine-id hash.
    expect(JSON.stringify(event)).not.toContain("secret");
    expect(JSON.stringify(event)).not.toContain("token=abc123");
    expect(JSON.stringify(event)).not.toContain("example.com");
    assertNoDeniedKeys(event);

    expect(event.Type).toBe("KeylensUsed");
    expect(event.Source).toBe("KeylensCLI");
    expect(event.MachineId).toBe("hashed-machine-id-value");
    expect(event.Result).toBe("success");
    expect(event.KeylensVersion).toBe(report.version);
    expect(event.RuleKeyboardTrapStatus).toBe("failed");
    expect(event.RuleKeyboardTrapViolations).toBe(1);
    expect(event.Profile).toBe(report.config.profile);
    expect(typeof event.SessionId).toBe("string");
    expect(typeof event.Timestamp).toBe("string");

    for (const value of Object.values(event)) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
    }
  });

  it("reports Result: partial when a rule could not be evaluated", () => {
    const report = makeAuditReport({
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        totalInfo: 0,
        passed: 7,
        failed: 0,
        errors: 1,
        score: 70,
        scoreComplete: false,
      },
    });

    const event = buildSuccessEvent(report, envelope);
    expect(event.Result).toBe("partial");
  });

  it("generates a fresh SessionId per event", () => {
    const report = makeAuditReport();
    const first = buildSuccessEvent(report, envelope);
    const second = buildSuccessEvent(report, envelope);
    expect(first.SessionId).not.toBe(second.SessionId);
  });

  it("maps typed KeylensError codes to failure/aborted/timeout results", () => {
    expect(
      buildFailureEvent("0.1.0", new ConfigError("bad config"), envelope)
        .Result,
    ).toBe("failure");
    expect(
      buildFailureEvent(
        "0.1.0",
        new AuditAbortedError("crawl", "https://example.com"),
        envelope,
      ).Result,
    ).toBe("aborted");
    expect(
      buildFailureEvent(
        "0.1.0",
        new AuditTimeoutError("crawl", 5000, "https://example.com"),
        envelope,
      ).Result,
    ).toBe("timeout");
  });

  it("never leaks the raw error message (only a fixed error code)", () => {
    const event = buildFailureEvent(
      "0.1.0",
      new ConfigError("path was /Users/alice/secret-project/config.json"),
      envelope,
    );
    expect(JSON.stringify(event)).not.toContain("alice");
    expect(JSON.stringify(event)).not.toContain("secret-project");
    expect(event.ErrorCode).toBe("CONFIG_ERROR");
  });

  it("falls back to INTERNAL_ERROR for unknown/non-KeylensError throwables", () => {
    expect(buildFailureEvent("0.1.0", new Error("boom"), envelope).Result).toBe(
      "failure",
    );
    expect(
      buildFailureEvent("0.1.0", new Error("boom"), envelope).ErrorCode,
    ).toBe("INTERNAL_ERROR");
    expect(buildFailureEvent("0.1.0", "not an error", envelope).ErrorCode).toBe(
      "INTERNAL_ERROR",
    );
  });
});
