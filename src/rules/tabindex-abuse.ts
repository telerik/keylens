import type { Rule, CrawlResult, RuleResult } from "../types/index.js";

/**
 * Detects elements using positive tabindex values,
 * which disrupt the natural focus order.
 */
export class TabindexAbuseRule implements Rule {
  id = "tabindex-abuse";
  name = "Tabindex Abuse";
  description =
    "Detects elements with positive tabindex values that disrupt natural focus order.";
  severity = "warning" as const;
  wcag = ["2.4.3"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const { interactiveElements } = crawlResult;

    // Check all interactive elements on the page (not just those reached via Tab),
    // since positive tabindex is a static HTML issue detectable from the DOM.
    const positiveTabindex = interactiveElements.filter(
      (el) => el.tabindexAttr !== null && el.tabindexAttr > 0,
    );

    if (positiveTabindex.length > 0) {
      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message: `${positiveTabindex.length} element(s) use positive tabindex values. This overrides the natural DOM order and often causes confusion.`,
        elements: positiveTabindex.map((el) => ({
          selector: el.selector,
          outerHTML: el.outerHTML,
          accessibleName: el.accessibleName || undefined,
        })),
        wcag: this.wcag,
        impact:
          'Positive tabindex values create a custom tab order that can be unpredictable. Use tabindex="0" instead and reorder the DOM.',
      });
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      violations,
      duration: 0,
    };
  }
}
