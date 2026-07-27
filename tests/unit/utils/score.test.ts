import { describe, it, expect } from "vitest";
import { computeScore } from "@/utils/score.js";
import { makeAuditReport } from "../../helpers/factories.js";
import type { RuleResult } from "@/types/index.js";

function makePassedRule(ruleId: string): RuleResult {
  return { ruleId, passed: true, violations: [], duration: 0 };
}

function makeFailedRule(
  ruleId: string,
  severity: "error" | "warning" = "error",
  elementCount = 1,
): RuleResult {
  return {
    ruleId,
    passed: false,
    violations: [
      {
        ruleId,
        ruleName: ruleId,
        severity,
        message: "violation",
        elements: Array.from({ length: elementCount }, (_, i) => ({
          selector: `#el-${i}`,
          outerHTML: "",
        })),
        impact: "test",
      },
    ],
    duration: 0,
  };
}

describe("computeScore", () => {
  it("returns 100 when all rules pass", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 10,
        totalInteractiveElements: 10,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
      },
      rules: [
        makePassedRule("keyboard-trap"),
        makePassedRule("unreachable-elements"),
        makePassedRule("focus-order-mismatch"),
        makePassedRule("tabindex-abuse"),
        makePassedRule("missing-focus-indicator"),
        makePassedRule("skip-link"),
        makePassedRule("focus-not-obscured"),
        makePassedRule("focus-after-interaction"),
      ],
    });

    expect(computeScore(report)).toBe(100);
  });

  it("returns 0 when all rules fail with full element coverage", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 10,
        totalInteractiveElements: 10,
        unreachedElements: 10,
        cycleCompleted: false,
        duration: 1000,
      },
      rules: [
        makeFailedRule("keyboard-trap", "error", 10),
        makeFailedRule("unreachable-elements", "error", 10),
        makeFailedRule("focus-order-mismatch", "error", 10),
        makeFailedRule("tabindex-abuse", "error", 10),
        makeFailedRule("missing-focus-indicator", "error", 10),
        makeFailedRule("skip-link", "error", 10),
        makeFailedRule("focus-not-obscured", "error", 10),
        makeFailedRule("focus-after-interaction", "error", 10),
      ],
    });

    expect(computeScore(report)).toBe(0);
  });

  it("is deterministic — same input always gives same output", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 42,
        totalInteractiveElements: 56,
        unreachedElements: 14,
        cycleCompleted: true,
        duration: 9000,
      },
      rules: [
        makePassedRule("keyboard-trap"),
        makeFailedRule("unreachable-elements", "error", 14),
        makeFailedRule("focus-order-mismatch", "warning", 40),
        makePassedRule("tabindex-abuse"),
        makeFailedRule("missing-focus-indicator", "error", 1),
        makeFailedRule("skip-link", "error", 1),
        makePassedRule("focus-not-obscured"),
        makePassedRule("focus-after-interaction"),
      ],
    });

    const score1 = computeScore(report);
    const score2 = computeScore(report);
    const score3 = computeScore(report);

    expect(score1).toBe(score2);
    expect(score2).toBe(score3);
  });

  it("gives higher score for warnings than errors on same rule", () => {
    const withError = makeAuditReport({
      crawl: {
        totalFocusableElements: 10,
        totalInteractiveElements: 10,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
      },
      rules: [makeFailedRule("keyboard-trap", "error", 5)],
    });

    const withWarning = makeAuditReport({
      crawl: {
        totalFocusableElements: 10,
        totalInteractiveElements: 10,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
      },
      rules: [makeFailedRule("keyboard-trap", "warning", 5)],
    });

    expect(computeScore(withWarning)).toBeGreaterThan(computeScore(withError));
  });

  it("gives higher score when fewer elements are affected", () => {
    const manyAffected = makeAuditReport({
      crawl: {
        totalFocusableElements: 50,
        totalInteractiveElements: 50,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
      },
      rules: [makeFailedRule("unreachable-elements", "error", 40)],
    });

    const fewAffected = makeAuditReport({
      crawl: {
        totalFocusableElements: 50,
        totalInteractiveElements: 50,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
      },
      rules: [makeFailedRule("unreachable-elements", "error", 2)],
    });

    expect(computeScore(fewAffected)).toBeGreaterThan(
      computeScore(manyAffected),
    );
  });

  it("handles empty rules array", () => {
    const report = makeAuditReport({ rules: [] });
    // No rules → no weight → 0/0 edge case handled as 0
    expect(computeScore(report)).toBe(0);
  });

  it("gives evaluator errors no accessibility weight", () => {
    const report = makeAuditReport({
      rules: [
        makePassedRule("keyboard-trap"),
        {
          ruleId: "unreachable-elements",
          passed: false,
          status: "error",
          violations: [],
          duration: 1,
          error: { code: "RULE_ERROR", message: "evaluation failed" },
        },
      ],
    });

    expect(computeScore(report)).toBe(20);
  });

  it("handles unknown rule IDs gracefully (0 weight)", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 10,
        totalInteractiveElements: 10,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
      },
      rules: [
        makePassedRule("keyboard-trap"),
        makeFailedRule("custom-rule", "error", 5),
      ],
    });

    // custom-rule has 0 weight, so it doesn't affect score
    // Only keyboard-trap (weight 20) of total 100 known weight
    // But since we only have 1 known rule passing, score = 20/100 * 100 = 20
    const score = computeScore(report);
    expect(score).toBe(20);
  });

  it("clamps score between 0 and 100", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 10,
        totalInteractiveElements: 10,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
      },
      rules: [makePassedRule("keyboard-trap")],
    });

    const score = computeScore(report);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
