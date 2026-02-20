# Keyboard Trap

| Property | Value                                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| ID       | `keyboard-trap`                                                                             |
| Severity | Error                                                                                       |
| WCAG     | [2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html) |

## What it checks

Detects elements that trap keyboard focus — the user can press Tab or Shift+Tab but focus stays on the same element.

## How it works

1. **Consecutive duplicate detection**: If the same element selector appears consecutively in the focus sequence, focus is likely trapped.
2. **Incomplete cycle warning**: If the tab cycle never returns to the first element (within `maxTabs` presses), a warning is raised indicating a possible infinite trap.

## Examples

### Fail

```html
<!-- JavaScript prevents Tab from moving focus away -->
<div role="combobox" onkeydown="event.preventDefault()">Search...</div>
```

### Pass

```html
<!-- Tab moves focus normally -->
<input type="search" placeholder="Search..." />
```

## How to fix

- Ensure all `keydown` handlers allow Tab and Shift+Tab to pass through
- For modal dialogs, trap focus within the dialog but allow Escape to close it
- Avoid calling `event.preventDefault()` on Tab key events
