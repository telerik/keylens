import { describe, it, expect, vi, beforeEach } from "vitest";
import { runRules } from "@/rules/index.js";
import { makeCrawlResult } from "@tests/helpers/factories.js";
import { DEFAULT_CONFIG } from "@/utils/config.js";

beforeEach(() => {
  vi.clearAllMocks();
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
      expect(result.duration).toBeGreaterThanOrEqual(0);
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
});
