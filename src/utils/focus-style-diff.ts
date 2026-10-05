import type { FocusStyleSnapshot, ComputedStyleMap } from "../types/index.js";

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

/** Returns the gate rule matching a property name and its regex match, if any. */
function findGateRule(
  key: string,
): { rule: GateRule; match: RegExpMatchArray } | undefined {
  for (const rule of GATE_RULES) {
    const match = key.match(rule.pattern);
    if (match) return { rule, match };
  }
  return undefined;
}

/** Returns true when a gated property's change can't have painted anything in either state. */
function isGatedPropertyInert(
  key: string,
  a: ComputedStyleMap,
  b: ComputedStyleMap,
): boolean {
  const found = findGateRule(key);
  if (!found) return false;
  const gateKey = found.rule.gate(found.match);
  const gateA = a[gateKey];
  const gateB = b[gateKey];
  return (
    (gateA === undefined || found.rule.inertWhen(gateA)) &&
    (gateB === undefined || found.rule.inertWhen(gateB))
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

/** Diffs two same-shaped chains of computed-style maps (ancestors or descendants) pairwise by index. */
function chainsDiffer(a: ComputedStyleMap[], b: ComputedStyleMap[]): boolean {
  const depth = Math.max(a.length, b.length);
  for (let i = 0; i < depth; i++) {
    if (mapsDiffer(a[i] ?? {}, b[i] ?? {})) return true;
  }
  return false;
}

/**
 * Returns true when any computed-style property differs between the focused
 * and unfocused snapshots — on the element itself, its ::before/::after
 * pseudo-elements, any ancestor, or any descendant in the captured chains —
 * i.e. the element visibly changes when it receives keyboard focus. Ignores
 * differences in gated properties (see GATE_RULES) that can't have rendered
 * anything.
 */
export function hasVisibleFocusChange(
  focused: FocusStyleSnapshot,
  unfocused: FocusStyleSnapshot,
): boolean {
  return (
    mapsDiffer(focused.self, unfocused.self) ||
    mapsDiffer(focused.before, unfocused.before) ||
    mapsDiffer(focused.after, unfocused.after) ||
    chainsDiffer(focused.ancestors ?? [], unfocused.ancestors ?? []) ||
    chainsDiffer(focused.descendants ?? [], unfocused.descendants ?? [])
  );
}
