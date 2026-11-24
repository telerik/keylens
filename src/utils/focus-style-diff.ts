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

/**
 * Computed properties that can paint a focus indicator. Anything else
 * (cursor, custom properties, transitions, caret-color, ...) can change on
 * focus without the user seeing anything, so it is ignored. A genuinely
 * visible indicator built from an unlisted property is not lost: it simply
 * counts as "no change" and falls through to the screenshot confirmation.
 */
const VISUAL_PROPERTY_PATTERNS: RegExp[] = [
  /^outline-(color|style|width|offset)$/,
  /^border-(top|right|bottom|left)-(color|style|width)$/,
  /^border-(top|bottom)-(left|right)-radius$/,
  /^border-image-source$/,
  /^(box|text)-shadow$/,
  /^text-decoration-(line|color|style|thickness)$/,
  /^text-underline-offset$/,
  /^background-(color|image|position-x|position-y|size)$/,
  /^(color|opacity|filter|backdrop-filter|transform|translate|rotate|scale|clip-path)$/,
  /^(fill|stroke|stroke-width)$/,
  /^(font-weight|font-style|letter-spacing)$/,
  /^(display|visibility)$/,
];

function isVisualProperty(key: string): boolean {
  return VISUAL_PROPERTY_PATTERNS.some((p) => p.test(key));
}

/** Properties that paint outside the element box and so can be clipped or covered. */
const OVERFLOWING_PROPERTY =
  /^(outline-(color|style|width|offset)|box-shadow)$/;

const COLOR_FUNCTION = /(?:rgba?|hsla?|color)\([^)]*\)/g;

/** Alpha of a computed color function, 1 when it has none. */
function colorAlpha(color: string): number {
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)/);
  if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1);
  const parts = color
    .slice(color.indexOf("(") + 1, color.lastIndexOf(")"))
    .split(",");
  return parts.length === 4 ? parseFloat(parts[3]) : 1;
}

/** Whether a computed value declares colors and every one of them is fully transparent. */
function isFullyTransparent(value: string | undefined): boolean {
  if (value === undefined) return false;
  if (value === "transparent") return true;
  const colors = value.match(COLOR_FUNCTION);
  return !!colors && colors.every((c) => colorAlpha(c) === 0);
}

function isZeroLength(value: string | undefined): boolean {
  return value !== undefined && parseFloat(value) === 0;
}

/**
 * Reduces a computed-style map to the visual properties that actually paint,
 * dropping decorations that are declared but cannot render: an outline or
 * border side that is none/zero-width/fully transparent, a transparent
 * shadow, or an element that is not rendered at all.
 */
function paintedVisualProperties(map: ComputedStyleMap): ComputedStyleMap {
  const out: ComputedStyleMap = {};
  for (const key of Object.keys(map)) {
    if (isVisualProperty(key)) out[key] = map[key];
  }

  if (
    out["outline-style"] === "none" ||
    isZeroLength(out["outline-width"]) ||
    isFullyTransparent(out["outline-color"])
  ) {
    for (const k of Object.keys(out)) {
      if (k.startsWith("outline-")) delete out[k];
    }
  }

  for (const side of ["top", "right", "bottom", "left"]) {
    const style = out[`border-${side}-style`];
    if (
      style === "none" ||
      style === "hidden" ||
      isZeroLength(out[`border-${side}-width`]) ||
      isFullyTransparent(out[`border-${side}-color`])
    ) {
      delete out[`border-${side}-color`];
      delete out[`border-${side}-style`];
      delete out[`border-${side}-width`];
    }
  }

  for (const shadow of ["box-shadow", "text-shadow"]) {
    if (out[shadow] === "none" || isFullyTransparent(out[shadow])) {
      delete out[shadow];
    }
  }
  if (
    out["text-decoration-line"] === "none" ||
    isFullyTransparent(out["text-decoration-color"])
  ) {
    for (const k of Object.keys(out)) {
      if (k.startsWith("text-decoration-") || k === "text-underline-offset") {
        delete out[k];
      }
    }
  }
  return out;
}

/** True when the map belongs to an element or pseudo-element that is not rendered. */
function isNotRendered(map: ComputedStyleMap, pseudo: boolean): boolean {
  if (map.display === "none") return true;
  if (map.visibility === "hidden" || map.visibility === "collapse") return true;
  return pseudo && (map.content === "none" || map.content === "normal");
}

/** An element running the same CSS animation in both states: its style changes come from time, not focus. */
function hasAmbientAnimation(
  a: ComputedStyleMap,
  b: ComputedStyleMap,
): boolean {
  const name = a["animation-name"];
  return !!name && name !== "none" && name === b["animation-name"];
}

/** Collects the visual properties that changed between two maps of the same element. */
function changedVisualProperties(
  a: ComputedStyleMap,
  b: ComputedStyleMap,
  pseudo = false,
): string[] {
  if (isNotRendered(a, pseudo) && isNotRendered(b, pseudo)) return [];
  if (hasAmbientAnimation(a, b)) return [];
  const pa = paintedVisualProperties(a);
  const pb = paintedVisualProperties(b);
  const keys = new Set([...Object.keys(pa), ...Object.keys(pb)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (pa[key] === pb[key]) continue;
    if (isGatedPropertyInert(key, a, b)) continue;
    changed.push(key);
  }
  return changed;
}

/**
 * How strongly the focused vs. unfocused snapshots say the element changes
 * visibly on focus:
 * - "none": no painted visual property differs.
 * - "weak": the only differences are outline/box-shadow, which paint outside
 *   the element box and can be clipped or covered, so the style diff alone
 *   cannot prove the user sees them.
 * - "strong": a property painted inside the element differs (border,
 *   background, color, text-decoration, transform, ...).
 */
export type FocusChangeStrength = "none" | "weak" | "strong";

export function classifyFocusChange(
  focused: FocusStyleSnapshot,
  unfocused: FocusStyleSnapshot,
): FocusChangeStrength {
  const changed = [
    ...changedVisualProperties(focused.self, unfocused.self),
    ...changedVisualProperties(focused.before, unfocused.before, true),
    ...changedVisualProperties(focused.after, unfocused.after, true),
  ];
  const chain = (a: ComputedStyleMap[] = [], b: ComputedStyleMap[] = []) => {
    const depth = Math.max(a.length, b.length);
    for (let i = 0; i < depth; i++) {
      changed.push(...changedVisualProperties(a[i] ?? {}, b[i] ?? {}));
    }
  };
  chain(focused.ancestors, unfocused.ancestors);
  chain(focused.descendants, unfocused.descendants);

  if (changed.length === 0) return "none";
  return changed.every((k) => OVERFLOWING_PROPERTY.test(k)) ? "weak" : "strong";
}

/**
 * Returns true when any painted visual property differs between the focused
 * and unfocused snapshots (see classifyFocusChange).
 */
export function hasVisibleFocusChange(
  focused: FocusStyleSnapshot,
  unfocused: FocusStyleSnapshot,
): boolean {
  return classifyFocusChange(focused, unfocused) !== "none";
}
