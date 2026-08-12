# Focus Not Obscured

| Property | Value                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------- |
| ID       | `focus-not-obscured`                                                                                     |
| Severity | Error                                                                                                    |
| WCAG     | [2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |

## What it checks

Detects when another element covers the center point of a focused element. This is a
single-point overlap heuristic, not a measurement of the covered area.

## How it works

For each focused element during the tab crawl, the crawler:

1. Gets the element's bounding rectangle
2. Calculates the center point of the element
3. Uses `document.elementFromPoint()` at that center
4. If the topmost element at that point is unrelated to the focused element, the
   element is considered obscured.

Partial overlap away from the center can be missed, and an intentional child/ancestor
relationship is not flagged.

## Examples

### Fail

```html
<!-- Sticky header covers focused elements when scrolled -->
<header
  style="position: fixed; top: 0; width: 100%; height: 60px; z-index: 100;"
>
  Navigation
</header>
<main>
  <!-- This link might be hidden behind the header when focused -->
  <a href="/about">About</a>
</main>
```

### Pass

```html
<!-- Header scrolls with content, doesn't obscure -->
<header>Navigation</header>
<main>
  <a href="/about">About</a>
</main>
```

## How to fix

- Use `scroll-padding-top` to account for fixed headers when elements are scrolled into view
- Ensure cookie banners and overlays don't cover focusable content
- Use `scroll-margin` on focusable elements to provide clearance from sticky elements
- Consider dismissing non-essential overlays when the user starts keyboard navigation

## Cookie/consent banners

Keylens auto-dismisses known cookie/consent banners before the crawl (see
[Configuration: prepare phase](../guide/configuration#prepare)), so this rule normally
evaluates the page in its post-consent state rather than flagging the banner itself. To
audit a banner deliberately — e.g. to verify it doesn't obscure focus while open — run
with `--keep-overlays` (`prepare.dismissOverlays: false`).
