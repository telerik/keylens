import type { Rule, CrawlResult, RuleResult } from "../types/index.js";

/**
 * Detects interactive elements (buttons, links, inputs, etc.)
 * that are visible on the page but never receive focus during tabbing.
 */
export class UnreachableElementsRule implements Rule {
  id = "unreachable-elements";
  name = "Unreachable Interactive Elements";
  description =
    "Detects interactive elements that cannot be reached via keyboard navigation.";
  severity = "error" as const;
  wcag = ["2.1.1"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const { interactiveElements } = crawlResult;

    const unreached = interactiveElements.filter((el) => !el.reached);

    if (unreached.length > 0) {
      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message: `${unreached.length} interactive element(s) are not reachable via keyboard.`,
        elements: unreached.map((el) => ({
          selector: el.selector,
          outerHTML: el.outerHTML,
        })),
        wcag: this.wcag,
        impact:
          "Keyboard users cannot access these interactive elements. All functionality must be operable through a keyboard interface.",
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
