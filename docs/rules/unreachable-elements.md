# Unreachable Elements

| Property | Value                                                                       |
| -------- | --------------------------------------------------------------------------- |
| ID       | `unreachable-elements`                                                      |
| Severity | Error                                                                       |
| WCAG     | [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) |

## What it checks

Detects interactive elements (buttons, links, inputs, etc.) that are visible on the page but never receive focus during keyboard navigation.

## How it works

1. The crawler discovers all interactive elements on the page using DOM queries (buttons, links, inputs, selects, textareas, elements with interactive ARIA roles).
2. After the tab crawl completes, each discovered element is cross-referenced against the focus sequence.
3. Elements that were never reached via Tab are flagged.

## Examples

### Fail

```html
<!-- Click handler on a div — not keyboard focusable -->
<div onclick="doSomething()" class="card">Click me</div>
```

### Pass

```html
<!-- Button is natively focusable -->
<button onclick="doSomething()" class="card">Click me</button>
```

## How to fix

- Use native interactive elements (`<button>`, `<a href>`, `<input>`) instead of `<div>` or `<span>` with click handlers
- If you must use a non-interactive element, add `tabindex="0"` and appropriate `role`
- Ensure elements with `display: none` or `visibility: hidden` are not discoverable as interactive
