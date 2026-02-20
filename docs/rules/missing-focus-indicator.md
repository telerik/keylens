# Missing Focus Indicator

| Property | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| ID       | `missing-focus-indicator`                                                             |
| Severity | Warning / Error                                                                       |
| WCAG     | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) |

## What it checks

Detects interactive elements that lack a visible focus indicator — keyboard users cannot see which element currently has focus.

## How it works

Keylens uses a two-phase detection approach:

### Phase 1: CSS Heuristic (always active)

Scans each element's `outerHTML` for patterns that suppress focus outlines:

- `outline: none`
- `outline: 0`
- `outline:none` (no space)
- `outline:0` (no space)

Elements matching these patterns are flagged with **Warning** severity.

### Phase 2: Screenshot Comparison (with `--screenshots`)

When `--screenshots` is enabled, the crawler captures:

- A **focused screenshot** of each element immediately after it receives focus
- An **unfocused screenshot** of the same element after focus moves away

These are compared pixel-by-pixel using [pixelmatch](https://github.com/mapbox/pixelmatch). If fewer than 1% of pixels differ, the element is considered to have no visible focus indicator and is flagged with **Error** severity.

This provides stronger evidence than the CSS heuristic, as it catches cases where focus styles are removed via external stylesheets, CSS classes, or are simply too subtle to see.

## Examples

### Fail

```html
<a href="/about" style="outline: none">About</a>
```

```css
/* External stylesheet — caught by screenshot diff, not CSS heuristic */
.nav-link:focus {
  outline: none;
}
```

### Pass

```html
<!-- Browser default focus ring -->
<a href="/about">About</a>

<!-- Custom focus style -->
<button class="btn" style="outline: none">
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
- Test with `--screenshots` to verify your focus styles are actually visible
