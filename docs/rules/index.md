# Rules

Keylens runs a set of rules against the keyboard focus sequence it captures from your page. Each rule checks for a specific category of keyboard accessibility issue.

## Rule Severity

- **Error** — Critical issues that block keyboard users. Causes a complete audit to fail
  (exit code 1); incomplete audits still return exit code 2.
- **Warning** — Issues that degrade the keyboard experience but don't fully block access.
- **Info** — Informational findings and suggestions.

## Available Rules

| Rule                                                          | ID                        | Severity        | WCAG         |
| ------------------------------------------------------------- | ------------------------- | --------------- | ------------ |
| [Keyboard Trap](./keyboard-trap)                              | `keyboard-trap`           | Error           | 2.1.2        |
| [Unreachable Elements](./unreachable-elements)                | `unreachable-elements`    | Error           | 2.1.1        |
| [Focus Order Mismatch](./focus-order-mismatch)                | `focus-order-mismatch`    | Warning         | 2.4.3        |
| [Tabindex Abuse](./tabindex-abuse)                            | `tabindex-abuse`          | Warning         | 2.4.3        |
| [Missing Focus Indicator](./missing-focus-indicator)          | `missing-focus-indicator` | Error           | 2.4.7        |
| [Skip Link](./skip-link)                                      | `skip-link`               | Warning / Error | 2.4.1        |
| [Focus Not Obscured](./focus-not-obscured)                    | `focus-not-obscured`      | Error           | 2.4.11       |
| [Focus After Interaction](./focus-after-interaction)          | `focus-after-interaction` | Error           | 2.4.3, 2.4.7 |
| [Broken Roving Tabindex Navigation](./roving-tabindex-broken) | `roving-tabindex-broken`  | Warning         | 2.1.1        |

::: tip Variable severity
**Skip Link**: A missing skip link is a Warning. A skip link that exists but doesn't move focus to main content is an Error.
:::

::: info Opt-in data collection
**Focus After Interaction** requires `--interactions` (or
`interactions.enabled: true` in config). Without interaction data, the rule passes with
no violations; that pass does not mean activation behavior was tested.
:::

::: info Heuristic verification
**Broken Roving Tabindex Navigation** verifies composite widgets (tabs, menus,
listboxes, etc.) by simulating real arrow-key presses, always runs (no flag
required), and reports as Warning rather than Error since it's a best-effort
simulation rather than a structural markup check.
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

Rule evaluator failures are reported separately from violations. They make the
deterministic score incomplete and produce CLI exit code `2`.
