import type { Rule, CrawlResult, RuleResult } from "../types/index.js";

/**
 * Focus Not Obscured rule (WCAG 2.2, SC 2.4.11).
 *
 * Detects when focused elements are entirely hidden behind author-created
 * content such as sticky headers, fixed footers, or cookie banners.
 */
export class FocusNotObscuredRule implements Rule {
  id = "focus-not-obscured";
  name = "Focus Not Obscured";
  description =
    "Ensures focused elements are not entirely hidden by sticky/fixed content.";
  severity = "error" as const;
  wcag = ["2.4.11"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const obscuredElements = crawlResult.focusSequence.filter(
      (el) => el.isObscured === true,
    );

    if (obscuredElements.length === 0) {
      return {
        ruleId: this.id,
        passed: true,
        violations: [],
        duration: 0,
      };
    }

    return {
      ruleId: this.id,
      passed: false,
      violations: [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          message: `${obscuredElements.length} focused element(s) are obscured by overlapping content when they receive focus. This violates WCAG 2.4.11 (Focus Not Obscured).`,
          elements: obscuredElements.map((el) => ({
            selector: el.selector,
            outerHTML: el.outerHTML,
            tabPosition: el.tabIndex,
          })),
          wcag: this.wcag,
          impact:
            "Keyboard users cannot see which element has focus, making the page unusable for keyboard navigation.",
        },
      ],
      duration: 0,
    };
  }
}
