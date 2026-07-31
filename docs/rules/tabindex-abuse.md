# Tabindex Abuse

| Property | Value                                                                             |
| -------- | --------------------------------------------------------------------------------- |
| ID       | `tabindex-abuse`                                                                  |
| Severity | Warning                                                                           |
| WCAG     | [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) |

## What it checks

Detects elements with positive `tabindex` values (`tabindex="1"`, `tabindex="5"`, etc.) which override the natural DOM-based focus order.

## How it works

Keylens inspects all discovered interactive elements, including elements that the Tab
crawl did not reach. Any numeric `tabindex` greater than 0 is flagged.

## Why it matters

Positive `tabindex` values create a custom tab order that takes precedence over the natural DOM order. This almost always leads to a confusing, unpredictable experience:

- Elements with `tabindex="1"` receive focus before everything else
- Multiple positive values create a parallel ordering system that's hard to maintain
- Adding or removing elements can silently break the intended order

## Examples

### Fail

```html
<button tabindex="5">Submit</button>
<button tabindex="1">Cancel</button>
<input tabindex="3" type="text" />
```

### Pass

```html
<!-- Natural DOM order, no tabindex needed -->
<input type="text" />
<button>Cancel</button>
<button>Submit</button>

<!-- tabindex="0" is fine — follows DOM order -->
<div role="button" tabindex="0">Custom button</div>
```

## How to fix

- Remove all positive `tabindex` values
- Reorder the DOM to match the desired focus sequence
- Use `tabindex="0"` to make non-interactive elements focusable without disrupting order
- Use `tabindex="-1"` to make elements programmatically focusable without adding them to the tab order
