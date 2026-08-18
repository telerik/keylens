# Focus Order Mismatch

| Property | Value                                                                             |
| -------- | --------------------------------------------------------------------------------- |
| ID       | `focus-order-mismatch`                                                            |
| Severity | Warning                                                                           |
| WCAG     | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) |

## What it checks

Detects when the keyboard focus order significantly diverges from DOM (content) order — a signal that `tabindex` or scripted focus management has reordered the tab sequence away from the natural content flow (see [F44](https://www.w3.org/WAI/WCAG21/Techniques/failures/F44)).

## How it works

1. All interactive elements are enumerated in DOM order (the order they appear in the document) before tabbing begins.
2. Each element's position in the observed focus sequence is compared to its position in DOM order.
3. Elements where the focus position differs from the DOM position by more than 3 places are flagged.

The tolerance of 3 positions avoids false positives from minor reordering that doesn't meaningfully disrupt the sequence.

Per the [WCAG 2.4.3 Understanding doc](https://www.w3.org/WAI/WCAG21/Understanding/focus-order), focus order does **not** need to follow visual/pixel layout — e.g. a nav sidebar column may legitimately receive focus fully before a shorter, independent main-content column. This rule intentionally compares against DOM order rather than screen position, since native tab order already equals DOM order unless something (tabindex, scripted `.focus()` calls) reorders it — comparing pixel coordinates instead produces false positives on any multi-column layout (nav + main + table-of-contents sidebars are extremely common).

## Examples

### Fail

```html
<!-- tabindex reorders focus away from DOM/content order -->
<nav>
  <a href="/home" tabindex="1">Home</a>
  <a href="/about" tabindex="3">About</a>
  <a href="/contact" tabindex="2">Contact</a>
</nav>
```

### Pass

```html
<!-- Focus follows natural DOM order -->
<nav>
  <a href="/home">Home</a>
  <a href="/about">About</a>
</nav>
<main>
  <a href="/contact">Contact</a>
</main>
```

## How to fix

- Remove positive `tabindex` values and let elements follow natural DOM order (see [Tabindex Abuse](/rules/tabindex-abuse))
- Avoid scripted focus management (e.g. manual `.focus()` calls) that jumps focus somewhere other than the next logical element
- When inserting dynamic content (menus, dialogs), place it adjacent to its trigger in the DOM so focus order stays adjacent to the trigger control (see [F85](https://www.w3.org/WAI/WCAG21/Techniques/failures/F85))
- Keep DOM order aligned with content sequence and relationships — visual/CSS layout does not need to match focus order as long as meaning and operability are preserved
