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
- Its immediate parent's `outline`, `box-shadow`, and `background-color` (for
  `:focus-within` container patterns)

If **any** of these properties differ between the focused and unfocused snapshots, the
element is considered to have a visible focus indicator. If none differ, it's flagged.

This runs by default — no flags required — because the crawler already focuses every
element for real during the tab crawl; reading computed styles twice is inexpensive.
It also catches indicators that a static HTML/CSS scan would miss, such as classes or
attributes toggled by JavaScript (e.g. `data-focus-visible`) and `:focus-within`
container highlighting.

Per-element screenshots (`--screenshots`) are unrelated to this detection — they feed
the separate AI focus-indicator-quality scoring feature, which rates contrast/visibility
of indicators that are already confirmed present.

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
