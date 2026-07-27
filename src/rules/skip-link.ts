import type { Rule, CrawlResult, RuleResult } from "../types/index.js";
import { SKIP_LINK_PATTERNS } from "../utils/constants.js";

/**
 * Validates the presence and functionality of skip navigation links.
 * Skip links allow keyboard users to bypass repetitive navigation
 * and jump directly to main content.
 *
 * Uses the crawler's skip link test result when available (functional test),
 * otherwise falls back to heuristic pattern matching on the focus sequence.
 */
export class SkipLinkRule implements Rule {
  id = "skip-link";
  name = "Skip Link";
  description =
    "Validates that a skip navigation link is present and functions correctly.";
  severity = "warning" as const;
  wcag = ["2.4.1"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const { focusSequence, skipLinkResult } = crawlResult;

    // If the crawler tested skip link functionality, use that result
    if (skipLinkResult) {
      if (!skipLinkResult.found) {
        violations.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          message:
            "No skip navigation link found among the first focusable elements. Keyboard users must tab through all navigation items to reach main content.",
          elements: [],
          wcag: this.wcag,
          impact:
            "Without a skip link, keyboard users must navigate through all header and navigation elements on every page load.",
        });
      } else if (!skipLinkResult.functionWorks) {
        violations.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: "error",
          message:
            "Skip link found but does not move focus to main content. The link may be missing an href target, or the target element may not be focusable.",
          elements: skipLinkResult.element
            ? [
                {
                  selector: skipLinkResult.element.selector,
                  outerHTML: skipLinkResult.element.outerHTML,
                },
              ]
            : [],
          wcag: this.wcag,
          impact:
            "Keyboard users see a skip link but it doesn't work, which is more confusing than having no skip link at all.",
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

    // Fallback: heuristic check on focus sequence (no crawler test available)
    const firstElements = focusSequence.slice(0, 5);
    const skipLink = firstElements.find((el) =>
      SKIP_LINK_PATTERNS.some(
        (pattern) =>
          pattern.test(el.accessibleName) || pattern.test(el.outerHTML),
      ),
    );

    if (!skipLink) {
      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message:
          "No skip navigation link found among the first focusable elements. Keyboard users must tab through all navigation items to reach main content.",
        elements: [],
        wcag: this.wcag,
        impact:
          "Without a skip link, keyboard users must navigate through all header and navigation elements on every page load.",
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
