import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** Per-pixel color-difference sensitivity (0-1, smaller = more sensitive). */
const PIXEL_DIFF_THRESHOLD = 0.15;

/** Ignore diffs below this many pixels — noise floor for anti-aliasing/font hinting. */
const MIN_DIFFERING_PIXELS = 12;

/**
 * Returns true when two same-sized focused/unfocused PNG screenshots show a
 * real visual difference. Used as a screenshot-based second opinion when
 * computed-style diffing (self/pseudo-elements/ancestors/descendants) finds
 * no change — catches indicators that diffing can't see at all, e.g. a focus
 * ring drawn inside a `<canvas>` bitmap by page JS, or styling applied via a
 * DOM relationship (sibling/portaled element) computed-style diffing doesn't
 * check.
 */
export function hasVisiblePixelDiff(
  focused: Buffer,
  unfocused: Buffer,
): boolean {
  const a = PNG.sync.read(focused);
  const b = PNG.sync.read(unfocused);
  if (a.width !== b.width || a.height !== b.height) {
    // Different capture dimensions (e.g. a layout shift between captures) —
    // can't compare reliably. Assume a difference so we never silently clear
    // a violation based on uncertain data.
    return true;
  }
  const diffPixels = pixelmatch(a.data, b.data, undefined, a.width, a.height, {
    threshold: PIXEL_DIFF_THRESHOLD,
  });
  return diffPixels >= MIN_DIFFERING_PIXELS;
}
