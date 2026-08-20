import type {
  Rule,
  CrawlResult,
  RuleResult,
  FocusedElement,
  FocusStyleSnapshot,
  ComputedStyleMap,
} from "../types/index.js";

/** Returns true if any property value differs between two computed-style maps. */
function mapsDiffer(a: ComputedStyleMap, b: ComputedStyleMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return true;
  }
  return false;
}

/**
 * Returns true when any computed-style property differs between the focused
 * and unfocused snapshots — on the element itself, its ::before/::after
 * pseudo-elements, or its immediate parent — i.e. the element visibly
 * changes when it receives keyboard focus.
 */
export function hasVisibleFocusChange(
  focused: FocusStyleSnapshot,
  unfocused: FocusStyleSnapshot,
): boolean {
  return (
    mapsDiffer(focused.self, unfocused.self) ||
    mapsDiffer(focused.before, unfocused.before) ||
    mapsDiffer(focused.after, unfocused.after) ||
    mapsDiffer(focused.parent ?? {}, unfocused.parent ?? {})
  );
}

/**
 * Detects interactive elements that lack a visible focus indicator (WCAG 2.4.7).
 *
 * Diffs the full computed-style declaration (every longhand CSS property, not
 * a curated subset) for the element, its ::before/::after pseudo-elements,
 * and its immediate parent, taken while the element was focused against one
 * taken once focus moved away. Any difference counts as a visible indicator —
 * this catches CSS pseudo-class styles, JS/attribute-driven indicators, and
 * :focus-within container patterns, regardless of which CSS property was
 * used to implement them, without needing screenshots.
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
      const hasIndicator = hasVisibleFocusChange(
        el.focusedStyleSnapshot,
        el.unfocusedStyleSnapshot,
      );
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
