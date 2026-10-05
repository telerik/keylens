# Keyboard Trap

| Property | Value                                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| ID       | `keyboard-trap`                                                                             |
| Severity | Error                                                                                       |
| WCAG     | [2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html) |
| Config   | `keyboardTrap`                                                                              |

## What it checks

Detects evidence that forward Tab navigation is stuck or does not cycle. Keylens does
not run a separate Shift+Tab escape test.

## How it works

1. **Consecutive duplicate detection**: If the same element selector appears consecutively in the focus sequence, focus is likely trapped.
2. **Incomplete cycle warning**: If the tab cycle never returns to the first element
   within `maxTabs` attempts, a warning is raised. Large or changing pages and timed-out
   Tab presses can also cause this warning.

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
