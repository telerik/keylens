import type {
  Rule,
  CrawlResult,
  RuleResult,
  FocusedElement,
} from "../types/index.js";

/**
 * Detects mismatches between the keyboard focus order and the
 * visual layout order (left-to-right, top-to-bottom).
 */
export class FocusOrderMismatchRule implements Rule {
  id = "focus-order-mismatch";
  name = "Focus Order Mismatch";
  description =
    "Detects when keyboard focus order doesn't match the visual layout order.";
  severity = "warning" as const;
  wcag = ["2.4.3"];

  /** Threshold in pixels — elements within this distance are considered same row */
  private static ROW_THRESHOLD = 50;

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const { focusSequence } = crawlResult;

    if (focusSequence.length < 2) {
      return {
        ruleId: this.id,
        passed: true,
        status: "passed",
        violations,
        duration: 0,
      };
    }

    // Sort elements by visual position (top-to-bottom, left-to-right)
    const visualOrder = [...focusSequence].sort((a, b) => {
      const rowDiff = a.boundingRect.y - b.boundingRect.y;
      if (Math.abs(rowDiff) > FocusOrderMismatchRule.ROW_THRESHOLD) {
        return rowDiff;
      }
      return a.boundingRect.x - b.boundingRect.x;
    });

    // Compare visual order to focus order
    const mismatches: Array<{
      element: FocusedElement;
      focusPosition: number;
      visualPosition: number;
    }> = [];

    for (let i = 0; i < focusSequence.length; i++) {
      const visualIndex = visualOrder.findIndex(
        (el) => el.selector === focusSequence[i].selector,
      );

      // Allow some tolerance — only flag significant jumps
      if (Math.abs(i - visualIndex) > 3) {
        mismatches.push({
          element: focusSequence[i],
          focusPosition: i + 1,
          visualPosition: visualIndex + 1,
        });
      }
    }

    if (mismatches.length > 0) {
      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message: `${mismatches.length} element(s) have a focus order that significantly differs from their visual position.`,
        elements: mismatches.map((m) => ({
          selector: m.element.selector,
          outerHTML: m.element.outerHTML,
          tabPosition: m.focusPosition,
          accessibleName: m.element.accessibleName || undefined,
        })),
        wcag: this.wcag,
        impact:
          "Keyboard users may be confused when focus jumps to unexpected locations that don't match the visual layout.",
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
