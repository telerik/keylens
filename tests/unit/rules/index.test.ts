import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runRules } from "@/rules/index.js";
import { makeCrawlResult } from "@tests/helpers/factories.js";
import { DEFAULT_CONFIG } from "@/utils/config.js";
import { MissingFocusIndicatorRule } from "@/rules/missing-focus-indicator.js";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runRules", () => {
  it("should run all enabled rules and return results", async () => {
    const crawlResult = makeCrawlResult({
      focusSequence: [],
      cycleCompleted: true,
    });

    const results = await runRules(crawlResult, DEFAULT_CONFIG);

    // All rules are enabled by default
    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result).toHaveProperty("ruleId");
      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("violations");
      expect(result).toHaveProperty("duration");
      expect(result.status).toBe(result.passed ? "passed" : "failed");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  it("reports evaluator failures separately from accessibility violations", async () => {
    vi.spyOn(MissingFocusIndicatorRule.prototype, "evaluate").mockRejectedValue(
      new Error("pixel comparison failed"),
    );

    const results = await runRules(makeCrawlResult(), DEFAULT_CONFIG);
    const result = results.find(
      (entry) => entry.ruleId === "missing-focus-indicator",
    );

    expect(result).toMatchObject({
      passed: false,
      status: "error",
      violations: [],
      error: {
        code: "RULE_ERROR",
        message: "pixel comparison failed",
      },
    });
  });

  it("should skip disabled rules", async () => {
    const crawlResult = makeCrawlResult();
    const config = {
      ...DEFAULT_CONFIG,
      rules: {
        ...DEFAULT_CONFIG.rules,
        keyboardTrap: false,
        unreachableElements: false,
        focusOrderMismatch: false,
        tabindexAbuse: false,
        missingFocusIndicator: false,
        skipLink: false,
        focusNotObscured: false,
        focusAfterInteraction: false,
      },
    };

    const results = await runRules(crawlResult, config);

    expect(results).toHaveLength(0);
  });

  it("should record duration on each result", async () => {
    const crawlResult = makeCrawlResult();

    const results = await runRules(crawlResult, DEFAULT_CONFIG);

    results.forEach((result) => {
      expect(typeof result.duration).toBe("number");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  it("emits rule progress with stable rule IDs", async () => {
    const events: string[] = [];

    await runRules(
      makeCrawlResult(),
      DEFAULT_CONFIG,
      undefined,
      (event) => {
        if (event.type === "rule-started" || event.type === "rule-completed") {
          events.push(`${event.type}:${event.ruleId}`);
        }
      },
      Date.now(),
    );

    expect(events).toContain("rule-started:keyboard-trap");
    expect(events).toContain("rule-completed:keyboard-trap");
    expect(events).toHaveLength(16);
  });
});
