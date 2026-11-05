# Missing Focus Indicator

| Property | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| ID       | `missing-focus-indicator`                                                             |
| Severity | Error                                                                                 |
| WCAG     | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) |
| Config   | `missingFocusIndicator`                                                               |

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

Only properties that can actually paint count (outline, border, box-shadow, text-shadow,
text-decoration, background, color, opacity, filter, transform, clip-path, fill/stroke, and a
few more). Changes to `cursor`, custom properties, transitions and similar never count.
Decorations that cannot render are ignored too: a transparent or zero-width outline or border,
a transparent shadow, a `::before`/`::after` without `content`, an element that is
`display:none` or `visibility:hidden`, and an element running the same CSS animation in both
states (its style changes come from time, not focus).

The remaining change is classified:

- **Strong** (border, background, color, text-decoration, transform, ... changed): the element
  has a visible focus indicator.
- **Weak** (only `outline` or `box-shadow` changed): these paint outside the element box and
  can be clipped by an ancestor or covered, so the crawler re-focuses the element and
  pixel-diffs a screenshot of its focused vs. blurred state (pixelmatch). No pixel change
  means the element is flagged. If the screenshot pass did not run (cap reached or capture
  failed) the style diff is trusted.
- **None**: the same screenshot check runs. It catches indicators the style diff cannot see,
  most notably a focus ring drawn inside a `<canvas>` bitmap by page JS, or styling applied
  via a sibling/portaled element. Only if the pixel diff also finds no change is the element
  flagged.

This runs by default — no flags required — because the crawler already focuses every
element for real during the tab crawl; reading computed styles twice is inexpensive, and
the screenshot confirmation only runs for elements the style diff could not fully prove
(weak or no change), capped per audit. CSS animations and transitions are
fast-forwarded to their end state before each screenshot, so an indicator that animates in on
focus is fully drawn while an ambient animation looks identical in both shots. It also catches indicators that a static HTML/CSS scan would miss,
such as classes or attributes toggled by JavaScript (e.g. `data-focus-visible`) and
`:focus-within` container highlighting.

Candidates that show no computed-style change receive a bounded focused-vs-unfocused
pixel comparison as a second opinion for indicators painted outside the inspected style
relationships.

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
