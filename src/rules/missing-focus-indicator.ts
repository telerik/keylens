import type {
  Rule,
  CrawlResult,
  RuleResult,
  FocusedElement,
  FocusStyleSnapshot,
  ComputedStyleMap,
} from "../types/index.js";

/**
 * Pattern-based rules for properties that CSS defines as no-ops unless a
 * "gate" property is active (e.g. outline-offset does nothing without a
 * rendered outline). Diffing these in isolation produces a false "visible
 * change" for something that paints nothing — confirmed in practice on a
 * real site where a shared base style toggled outline-offset on :focus while
 * the component separately set outline: none, leaving outline-style: none /
 * outline-width: 0px unchanged in both states.
 *
 * Expressed as patterns (one rule covers a whole property family, e.g. all
 * four border sides) rather than a per-property list, since the same
 * shorthand-family shape recurs across CSS: a "does it render at all" flag
 * property (line/style/name/image) paired with detail properties that are
 * inert without it.
 */
interface GateRule {
  /** Matches the dependent (potentially inert) property name. */
  pattern: RegExp;
  /** Derives the gate property name from the match (e.g. per border side). */
  gate: (match: RegExpMatchArray) => string;
  /** Whether the gate's value means "nothing is rendered". */
  inertWhen: (value: string) => boolean;
}

const GATE_RULES: GateRule[] = [
  // outline-color/-width/-offset render nothing without outline-style.
  {
    pattern: /^outline-(?!style$)/,
    gate: () => "outline-style",
    inertWhen: (v) => v === "none",
  },
  // border-{side}-color/-style render nothing without that side's width.
  {
    pattern: /^border-(top|right|bottom|left)-(color|style)$/,
    gate: (m) => `border-${m[1]}-width`,
    inertWhen: (v) => v === "0px",
  },
  // text-decoration-color/-thickness/-style render nothing without a line.
  {
    pattern: /^text-decoration-(?!line$)/,
    gate: () => "text-decoration-line",
    inertWhen: (v) => v === "none",
  },
  // background-position/-size/-repeat/-attachment/-origin/-clip render
  // nothing without an actual background image to position.
  {
    pattern:
      /^background-(position|size|repeat|attachment|origin|clip)(-[xy])?$/,
    gate: () => "background-image",
    inertWhen: (v) => v === "none",
  },
  // animation-duration/-delay/-timing-function/etc. render nothing without
  // an actual named animation running.
  {
    pattern: /^animation-(?!name$)/,
    gate: () => "animation-name",
    inertWhen: (v) => v === "none",
  },
];

/** Returns the gate rule matching a property name, if any. */
function findGateRule(key: string): GateRule | undefined {
  return GATE_RULES.find((rule) => rule.pattern.test(key));
}

/** Returns true when a gated property's change can't have painted anything in either state. */
function isGatedPropertyInert(
  key: string,
  a: ComputedStyleMap,
  b: ComputedStyleMap,
): boolean {
  const rule = findGateRule(key);
  if (!rule) return false;
  const gateKey = rule.gate(key.match(rule.pattern)!);
  const gateA = a[gateKey];
  const gateB = b[gateKey];
  return (
    (gateA === undefined || rule.inertWhen(gateA)) &&
    (gateB === undefined || rule.inertWhen(gateB))
  );
}

/** Returns true if any property value differs between two computed-style maps. */
function mapsDiffer(a: ComputedStyleMap, b: ComputedStyleMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] === b[key]) continue;
    if (isGatedPropertyInert(key, a, b)) continue;
    return true;
  }
  return false;
}

/**
 * Returns true when any computed-style property differs between the focused
 * and unfocused snapshots — on the element itself, its ::before/::after
 * pseudo-elements, or its immediate parent — i.e. the element visibly
 * changes when it receives keyboard focus. Ignores differences in gated
 * properties (see GATE_RULES) that can't have rendered anything.
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
