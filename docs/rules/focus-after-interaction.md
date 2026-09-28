# Focus After Interaction

| Property | Value                     |
| -------- | ------------------------- |
| ID       | `focus-after-interaction` |
| Severity | Error                     |
| WCAG     | 2.4.3, 2.4.7              |
| Config   | `focusAfterInteraction`   |

## What it checks

For each attempted activation, focus must remain on the original control or move to a
visible interactive or managed target. Lost focus and unexpected noninteractive focus
are failures.

The rule requires interaction testing to be enabled. Without interaction data it passes
with no violations, which means “not tested,” not that activation behavior is valid.

## Eligible controls

Candidates come from the recorded focus sequence and include buttons,
`role="button"`, and button/checkbox/radio inputs. The configured action list can
contain `click`, `enter`, and `space`.

Default safeguards:

- at most 20 attempted cases;
- 2-second timeout for each focus or activation operation;
- page reload before each case;
- top-level navigation blocked;
- likely destructive labels skipped;
- optional include/exclude selector policies.

These safeguards are heuristic and cannot prevent every side effect. Use disposable
test data and narrow `include` selectors.

## Outcomes

Each `interactionResults[]` item has:

- `passed` with `focus-preserved` or `focus-moved`;
- `failed` with `focus-lost` or `unexpected-focus`;
- `skipped` with `excluded`, `destructive`, `limit-reached`, or
  `navigation-blocked`;
- `error` with `element-missing` or `action-failed`.

Failed cases become error-severity violations. If there are only error cases, the rule
has `status: "error"`, the score is incomplete, and the CLI exits `2`. Inspect JSON for
the action, resulting focus, stable reason, message, and duration of every case.

## Configuration

```json
{
  "interactions": {
    "enabled": true,
    "maxCases": 20,
    "timeout": 2000,
    "include": [".audit-safe"],
    "exclude": [".opens-payment"],
    "actions": ["click", "enter", "space"],
    "isolation": "reload",
    "navigation": "block",
    "excludeDestructive": true
  },
  "timeouts": { "interactions": 30000 },
  "rules": { "focusAfterInteraction": true }
}
```

## How to fix

When activation removes a control or opens transient UI, move focus to a visible,
logical target such as the opened dialog. Restore focus to the trigger or another
deterministic control when the UI closes.
