# Focus Order Mismatch

| Property | Value                                                                             |
| -------- | --------------------------------------------------------------------------------- |
| ID       | `focus-order-mismatch`                                                            |
| Severity | Warning                                                                           |
| WCAG     | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) |

## What it checks

Detects when the keyboard focus order significantly differs from the visual layout order (top-to-bottom, left-to-right).

## How it works

1. Elements are sorted by their visual position — first by vertical position (Y coordinate), then by horizontal position (X) for elements in the same row (within a 50px threshold).
2. Each element's position in the focus sequence is compared to its visual position.
3. Elements where the focus position differs from the visual position by more than 3 places are flagged.

The tolerance of 3 positions avoids false positives from minor layout variations (e.g., a logo link that's visually centered but first in DOM order).

This geometric heuristic assumes top-to-bottom, left-to-right layout. It does not
understand language direction, component semantics, or author intent, so findings
require human review.

## Examples

### Fail

```html
<!-- Footer link receives focus before main content -->
<footer>
  <a href="/contact" tabindex="1">Contact</a>
</footer>
<main>
  <a href="/about">About</a>
</main>
```

### Pass

```html
<!-- Focus follows visual top-to-bottom order -->
<nav>
  <a href="/home">Home</a>
  <a href="/about">About</a>
</nav>
<main>
  <a href="/contact">Contact</a>
</main>
```

## How to fix

- Match DOM order to visual order — CSS layout (flexbox `order`, grid placement, `position: absolute`) should not reorder content in ways that confuse focus sequence
- Remove positive `tabindex` values (see [Tabindex Abuse](/rules/tabindex-abuse))
- Keep DOM, reading, and visual order aligned; avoid CSS reordering that creates a
  different keyboard sequence
