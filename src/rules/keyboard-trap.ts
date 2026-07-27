import type { Rule, CrawlResult, RuleResult } from "../types/index.js";

/**
 * Detects keyboard traps — elements that receive focus but cannot
 * be navigated away from using Tab or Shift+Tab.
 *
 * Detection heuristic: If the same element appears consecutively
 * in the focus sequence more than once, focus may be trapped.
 * Also flags if the tab cycle did not complete (possible infinite trap).
 */
export class KeyboardTrapRule implements Rule {
  id = "keyboard-trap";
  name = "Keyboard Trap";
  description =
    "Detects elements that trap keyboard focus, preventing users from navigating away.";
  severity = "error" as const;
  wcag = ["2.1.2"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const { focusSequence, cycleCompleted } = crawlResult;

    // Check for consecutive duplicate elements (focus stuck)
    for (let i = 1; i < focusSequence.length; i++) {
      const prev = focusSequence[i - 1];
      const curr = focusSequence[i];

      if (prev.selector === curr.selector) {
        violations.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          message: `Focus appears trapped at element. The same element received focus consecutively at positions ${prev.tabIndex} and ${curr.tabIndex}.`,
          elements: [
            {
              selector: curr.selector,
              outerHTML: curr.outerHTML,
              tabPosition: curr.tabIndex,
              accessibleName: curr.accessibleName || undefined,
            },
          ],
          wcag: this.wcag,
          impact:
            "Users cannot navigate past this element using the keyboard, making all subsequent content inaccessible.",
        });
      }
    }

    // Flag if tab cycle never completed (potential infinite trap)
    if (!cycleCompleted && focusSequence.length > 0) {
      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: "warning",
        message: `Tab cycle did not complete after ${focusSequence.length} tab presses. Focus may be trapped or the page has an unusually large number of focusable elements.`,
        elements: [],
        wcag: this.wcag,
        impact:
          "The tab cycle did not return to the starting element, which may indicate a keyboard trap.",
      });
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      status: violations.length === 0 ? "passed" : "failed",
      violations,
      duration: 0,
    };
  }
}
