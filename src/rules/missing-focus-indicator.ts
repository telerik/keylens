import type {
  Rule,
  CrawlResult,
  RuleResult,
  FocusedElement,
} from "../types/index.js";
import { hasVisibleFocusChange } from "../utils/focus-style-diff.js";

export { hasVisibleFocusChange };

/**
 * Detects interactive elements that lack a visible focus indicator (WCAG 2.4.7).
 *
 * Diffs the full computed-style declaration (every longhand CSS property, not
 * a curated subset) for the element, its ::before/::after pseudo-elements,
 * and a chain of ancestors, taken while the element was focused against one
 * taken once focus moved away. Any difference counts as a visible indicator —
 * this catches CSS pseudo-class styles, JS/attribute-driven indicators, and
 * :focus-within container patterns (including ones applied several levels up
 * the tree, not just the direct parent), regardless of which CSS property
 * was used to implement them, without needing screenshots.
 */
export class MissingFocusIndicatorRule implements Rule {
  id = "missing-focus-indicator";
  name = "Missing Focus Indicator";
  description =
    "Detects interactive elements that lack a visible focus indicator.";
  severity = "error" as const;
  wcag = ["2.4.7"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const { focusSequence } = crawlResult;

    const noIndicatorElements: FocusedElement[] = [];
    for (const el of focusSequence) {
      if (!el.focusedStyleSnapshot || !el.unfocusedStyleSnapshot) {
        el.hasFocusIndicator = null;
        continue;
      }
      const hasIndicator =
        hasVisibleFocusChange(
          el.focusedStyleSnapshot,
          el.unfocusedStyleSnapshot,
        ) || el.focusIndicatorPixelConfirmed === true;
      el.hasFocusIndicator = hasIndicator;
      if (!hasIndicator) {
        noIndicatorElements.push(el);
      }
    }

    if (noIndicatorElements.length === 0) {
      return {
        ruleId: this.id,
        passed: true,
        status: "passed",
        violations: [],
        duration: 0,
      };
    }

    return {
      ruleId: this.id,
      passed: false,
      status: "failed",
      violations: [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: this.severity,
          message: `${noIndicatorElements.length} element(s) show no visible change between focused and unfocused states.`,
          elements: noIndicatorElements.map((el) => ({
            selector: el.selector,
            outerHTML: el.outerHTML,
            tabPosition: el.tabIndex,
            accessibleName: el.accessibleName || undefined,
          })),
          wcag: this.wcag,
          impact:
            "Keyboard users cannot see which element currently has focus, making navigation extremely difficult.",
        },
      ],
      duration: 0,
    };
  }
}
