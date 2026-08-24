# Missing Focus Indicator

| Property | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| ID       | `missing-focus-indicator`                                                             |
| Severity | Error                                                                                 |
| WCAG     | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) |

## What it checks

Detects interactive elements that lack a visible focus indicator — keyboard users cannot see which element currently has focus.

## How it works

While tabbing through the page, the crawler captures a computed-style snapshot of each
element the moment it receives focus, and another snapshot of the same element once
focus moves away. The snapshot covers:

- The element's own `outline`, `outline-offset`, `box-shadow`, `border`, `background-color`,
  `color`, `text-decoration-line`, `filter`, and `background-image`
- Its `::before` / `::after` pseudo-elements (`content` and `box-shadow`)
- Up to 4 levels of ancestors' `outline`, `box-shadow`, and `background-color` (for
  `:focus-within` container patterns, which are commonly applied to a wrapper several
  levels up — e.g. a form-group or fieldset around a label and input — not just the
  element's direct parent)
- Up to 20 descendants (for indicators painted on an inner child instead of the
  focusable element itself — e.g. a toggle switch whose visible ring is drawn on its
  inner track `<span>` via a `.switch:focus .track { outline: ... }` rule)

If **any** of these properties differ between the focused and unfocused snapshots, the
element is considered to have a visible focus indicator. If none differ, the crawler runs
one more check before flagging it: it re-focuses the element and pixel-diffs a screenshot
of its focused vs. blurred state (pixelmatch). This catches indicators that live entirely
outside the computed-style diff's reach — most notably a focus ring drawn inside a
`<canvas>` bitmap by page JS, or styling applied via a sibling/portaled element. Only if
both the style diff _and_ the pixel diff find no change is the element flagged.

This runs by default — no flags required — because the crawler already focuses every
element for real during the tab crawl; reading computed styles twice is inexpensive, and
the pixel-diff confirmation only runs for the (typically small) set of elements the style
diff already flagged. It also catches indicators that a static HTML/CSS scan would miss,
such as classes or attributes toggled by JavaScript (e.g. `data-focus-visible`) and
`:focus-within` container highlighting.

Per-element screenshots (`--screenshots`) are a separate, opt-in concern — they feed the
AI focus-indicator-quality scoring feature, which rates contrast/visibility of indicators
that are already confirmed present. They're unrelated to the always-on pixel-diff
confirmation pass described above.

## Examples

### Fail

```html
<a href="/about" style="outline: none">About</a>
```

```css
/* No compensating style — outline is truly gone with nothing replacing it */
.nav-link:focus {
  outline: none;
}
```

### Pass

```html
<!-- Browser default focus ring -->
<a href="/about">About</a>

<!-- Custom focus style -->
<button class="btn">
  <!-- Has box-shadow focus style instead -->
</button>
```

```css
.btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
}
```

## How to fix

- Never remove focus outlines without providing a visible alternative
- Use `:focus-visible` instead of `:focus` to only show focus styles for keyboard navigation
- Ensure custom focus indicators have sufficient contrast (at least 3:1 ratio)
- Use `--screenshots` to get an AI-scored quality rating of indicators already detected as present
