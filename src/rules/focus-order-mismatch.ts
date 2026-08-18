import type {
  Rule,
  CrawlResult,
  RuleResult,
  FocusedElement,
} from "../types/index.js";

/**
 * Detects mismatches between the keyboard focus order and DOM (content) order.
 *
 * Per the WCAG 2.4.3 Understanding doc, focus order does NOT need to follow
 * visual/pixel layout — e.g. a nav sidebar column may legitimately receive
 * focus fully before a shorter main-content column, even though that looks
 * like a "mismatch" if compared by screen position. The sanctioned techniques
 * (G59, C27) and the documented failure condition (F44) are framed around
 * DOM/content order instead: native tab order already equals DOM order unless
 * something (tabindex, scripted focus management) reorders it, so a
 * divergence between observed focus order and DOM order is the meaningful
 * signal to flag.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/focus-order
 * @see https://www.w3.org/WAI/WCAG21/Techniques/failures/F44
 */
export class FocusOrderMismatchRule implements Rule {
  id = "focus-order-mismatch";
  name = "Focus Order Mismatch";
  description =
    "Detects when keyboard focus order diverges from DOM order (e.g. via tabindex or scripted focus changes), which can create a confusing or illogical tab sequence.";
  severity = "warning" as const;
  wcag = ["2.4.3"];

  /** Only flag jumps larger than this many positions in the DOM-order ranking */
  private static POSITION_TOLERANCE = 3;

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const { focusSequence, interactiveElements } = crawlResult;

    if (focusSequence.length < 2) {
      return {
        ruleId: this.id,
        passed: true,
        status: "passed",
        violations,
        duration: 0,
      };
    }

    // interactiveElements is captured via a single querySelectorAll() pass before
    // any tabbing occurs. querySelectorAll returns nodes in document order per
    // spec, so its array index is an authoritative, scroll-immune DOM-order
    // reference — unlike pixel rects captured live during the tab crawl.
    const domIndexBySelector = new Map<string, number>(
      interactiveElements.map((el, index) => [el.selector, index]),
    );

    // Only elements we have a DOM-order reference for can be compared.
    const comparable = focusSequence.filter((el) =>
      domIndexBySelector.has(el.selector),
    );

    if (comparable.length < 2) {
      return {
        ruleId: this.id,
        passed: true,
        status: "passed",
        violations,
        duration: 0,
      };
    }

    const domOrder = [...comparable].sort(
      (a, b) =>
        domIndexBySelector.get(a.selector)! -
        domIndexBySelector.get(b.selector)!,
    );

    const mismatches: Array<{
      element: FocusedElement;
      focusPosition: number;
      domPosition: number;
    }> = [];

    for (let i = 0; i < comparable.length; i++) {
      const domPosition = domOrder.findIndex(
        (el) => el.selector === comparable[i].selector,
      );

      // Allow some tolerance — only flag significant jumps
      if (
        Math.abs(i - domPosition) > FocusOrderMismatchRule.POSITION_TOLERANCE
      ) {
        mismatches.push({
          element: comparable[i],
          focusPosition: comparable[i].tabIndex,
          domPosition: domPosition + 1,
        });
      }
    }

    if (mismatches.length > 0) {
      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message: `${mismatches.length} element(s) receive focus in an order that significantly differs from their position in the DOM.`,
        elements: mismatches.map((m) => ({
          selector: m.element.selector,
          outerHTML: m.element.outerHTML,
          tabPosition: m.focusPosition,
          accessibleName: m.element.accessibleName || undefined,
        })),
        wcag: this.wcag,
        impact:
          "Keyboard users may be confused when focus jumps to a place in the page's structure that doesn't match the surrounding content's sequence. This commonly happens when tabindex values or scripted focus management reorder the tab sequence away from natural content order.",
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
