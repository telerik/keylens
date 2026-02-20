# Focus After Interaction

| Property | Value                     |
| -------- | ------------------------- |
| ID       | `focus-after-interaction` |
| Severity | Error                     |
| WCAG     | 2.4.3, 2.4.7              |
| Config   | `focusAfterInteraction`   |

## What It Checks

After clicking a button or `role="button"` element, focus should remain on a sensible target — the clicked element itself, a child, or a newly opened container (e.g., a dialog). If focus reverts to `<body>` or is lost entirely, that's a problem for keyboard users who lose their place on the page.

This rule requires the `--interactions` flag (or `interactions: true` in config) to collect data. Without it, the rule has no interaction results to evaluate and passes automatically.

## How It Works

1. The crawler's `crawlInteractions()` phase runs after the tab crawl
2. It focuses each button/`role="button"` element from the focus sequence
3. It clicks the element and checks `document.activeElement`
4. If focus is on `<body>` or `null`, the interaction is marked as `focusReasonable: false`
5. Each failed interaction produces a separate violation

Links are skipped (to avoid page navigation) and `type="submit"` inputs are skipped (to avoid form submission).

## Examples

### Fail

```html
<!-- Button that loses focus on click -->
<button onclick="this.blur()">Bad Button</button>
```

### Pass

```html
<!-- Button that keeps focus -->
<button onclick="openDialog()">Open Settings</button>

<!-- Focus moves to dialog (reasonable) -->
<dialog id="settings">...</dialog>
```

## Configuration

Enable interaction testing via CLI:

```bash
keylens audit https://example.com --interactions
```

Or via config file:

```json
{
  "interactions": true,
  "rules": {
    "focusAfterInteraction": true
  }
}
```

To disable this rule while keeping interaction testing:

```json
{
  "interactions": true,
  "rules": {
    "focusAfterInteraction": false
  }
}
```
