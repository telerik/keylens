import type { AuditReport } from "../types/index.js";

/**
 * Weight each rule carries toward the overall score.
 * Weights are based on WCAG severity and user impact.
 * They sum to 100 so the raw score maps directly to a percentage.
 */
const RULE_WEIGHTS: Record<string, number> = {
  "keyboard-trap": 20, // WCAG 2.1.2 – complete blocker
  "unreachable-elements": 20, // WCAG 2.1.1 – functional blocker
  "skip-link": 10, // WCAG 2.4.1 – bypass blocks
  "focus-order-mismatch": 15, // WCAG 2.4.3 – navigation predictability
  "missing-focus-indicator": 15, // WCAG 2.4.7 – focus visibility
  "tabindex-abuse": 5, // WCAG 2.4.3 – positive tabindex
  "focus-not-obscured": 10, // WCAG 2.4.11 – focus not hidden
  "focus-after-interaction": 5, // WCAG 2.4.3/2.4.7 – post-click focus
};

const TOTAL_WEIGHT = Object.values(RULE_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * Compute a deterministic 0–100 accessibility score from rule results.
 *
 * Scoring logic per rule:
 * - Passed rule → earns its full weight.
 * - Failed rule → partial credit based on severity and proportion of
 *   affected elements relative to total interactive elements.
 *
 * This ensures the same audit data always produces the same score,
 * unlike the AI-generated `aiSeverityRating` which varies between runs.
 */
export function computeScore(report: AuditReport): number {
  const totalInteractive = Math.max(report.crawl.totalInteractiveElements, 1);
  let earned = 0;

  for (const rule of report.rules) {
    const weight = RULE_WEIGHTS[rule.ruleId] ?? 0;

    if (rule.passed) {
      earned += weight;
      continue;
    }

    // For failed rules, deduct proportionally to how many elements are affected.
    // A rule that affects 1 of 50 elements is much less severe than one affecting 40 of 50.
    const affectedCount = rule.violations.reduce(
      (sum, v) => sum + v.elements.length,
      0,
    );

    // Severity multiplier: errors lose more than warnings
    const hasErrors = rule.violations.some((v) => v.severity === "error");
    const severityMultiplier = hasErrors ? 1.0 : 0.5;

    // Proportion of affected elements (clamped to 1.0)
    const proportion = Math.min(affectedCount / totalInteractive, 1.0);

    // Deduction: full weight × severity × proportion, with a minimum penalty
    // of 30% of the weight (so even 1 affected element noticeably impacts score)
    const deduction =
      weight * severityMultiplier * Math.max(proportion, 0.3);

    earned += Math.max(weight - deduction, 0);
  }

  // Normalize to 0–100 (handles custom rule sets that don't sum to 100)
  const normalized = (earned / TOTAL_WEIGHT) * 100;

  return Math.round(Math.max(0, Math.min(100, normalized)));
}
