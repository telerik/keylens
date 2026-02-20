# Rules

Keylens runs a set of rules against the keyboard focus sequence it captures from your page. Each rule checks for a specific category of keyboard accessibility issue.

## Rule Severity

- **Error** — Critical issues that block keyboard users. Causes CI to fail (exit code 1).
- **Warning** — Issues that degrade the keyboard experience but don't fully block access.
- **Info** — Informational findings and suggestions.

## Available Rules

| Rule                                                      | ID                        | Severity        | WCAG         |
| --------------------------------------------------------- | ------------------------- | --------------- | ------------ |
| [Keyboard Trap](/rules/keyboard-trap)                     | `keyboard-trap`           | Error           | 2.1.2        |
| [Unreachable Elements](/rules/unreachable-elements)       | `unreachable-elements`    | Error           | 2.1.1        |
| [Focus Order Mismatch](/rules/focus-order-mismatch)       | `focus-order-mismatch`    | Warning         | 2.4.3        |
| [Tabindex Abuse](/rules/tabindex-abuse)                   | `tabindex-abuse`          | Warning         | 2.4.3        |
| [Missing Focus Indicator](/rules/missing-focus-indicator) | `missing-focus-indicator` | Warning / Error | 2.4.7        |
| [Skip Link](/rules/skip-link)                             | `skip-link`               | Warning / Error | 2.4.1        |
| [Focus Not Obscured](/rules/focus-not-obscured)           | `focus-not-obscured`      | Error           | 2.4.11       |
| [Focus After Interaction](/rules/focus-after-interaction) | `focus-after-interaction` | Error           | 2.4.3, 2.4.7 |

::: tip Variable severity
**Missing Focus Indicator**: CSS heuristic detection (e.g. `outline: none`) reports as Warning. When `--screenshots` is enabled and pixelmatch confirms no visible change, severity is upgraded to Error.

**Skip Link**: A missing skip link is a Warning. A skip link that exists but doesn't move focus to main content is an Error.
:::

::: info Opt-in data collection
**Focus After Interaction** requires `--interactions` (or `interactions: true` in config) to collect interaction data. Without it, the rule passes automatically with no violations.
:::

## Disabling Rules

In `keylens.config.json`:

```json
{
  "rules": {
    "keyboardTrap": true,
    "skipLink": false,
    "focusNotObscured": true
  }
}
```

## Contributing Rules

Each rule implements the `Rule` interface from `src/types/index.ts`. See the [API reference](/api/) for the interface definition and existing rules in `src/rules/` for examples.
