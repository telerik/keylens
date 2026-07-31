# CLI reference

## Commands

### `keylens audit [url]`

Alias: `keylens scan [url]`. An HTTP(S) URL can also be passed directly as shorthand.
The URL argument overrides `urls` from the config file. Without an argument, all
configured URLs are audited.

| Option                     | Default            | Description                                    |
| -------------------------- | ------------------ | ---------------------------------------------- |
| `-c, --config <path>`      | —                  | JSON config path                               |
| `--profile <profile>`      | `balanced`         | `fast`, `balanced`, or `thorough`              |
| `-o, --output <reporters>` | `cli`              | Comma-separated `cli,json,html,markdown`       |
| `-d, --output-dir <dir>`   | `./keylens-report` | File reporter destination                      |
| `-b, --browser <browser>`  | `chromium`         | `chromium`, `firefox`, or `webkit`             |
| `--headed`                 | `false`            | Show the browser                               |
| `--wait-for <selector>`    | —                  | Wait for a CSS selector before the fixed delay |
| `--wait <ms>`              | profile value      | Fixed delay after load                         |
| `--max-tabs <n>`           | profile value      | Maximum Tab attempts                           |
| `--tab-delay <ms>`         | profile value      | Delay after each Tab; minimum 10 ms            |
| `--viewport <WxH>`         | `1280x720`         | Browser viewport                               |
| `--timeout <ms>`           | `30000`            | Navigation timeout                             |
| `--page-screenshot <mode>` | capability-based   | `none`, `viewport`, or `full`                  |
| `--screenshots`            | `false`            | Capture bounded focus-state pairs              |
| `--interactions`           | `false`            | Enable experimental bounded activations        |
| `--ai`                     | `false`            | Enable experimental AI                         |
| `--ai-model <model>`       | provider default   | Override the AI model                          |
| `--ai-provider <provider>` | `anthropic`        | `anthropic` or `openai`                        |
| `--ai-base-url <url>`      | —                  | OpenAI-compatible or Azure endpoint            |
| `-q, --quiet`              | `false`            | Suppress nonessential output                   |
| `-v, --verbose`            | `false`            | Enable debug diagnostics                       |

CLI values override config values. `--headed`, `--screenshots`, `--interactions`, and
`--ai` enable their features; they do not provide `--no-*` forms.

### Page screenshots and focus-state pairs

These are separate capture modes:

- `--page-screenshot viewport|full` captures one page image. `none` disables it.
- `--screenshots` captures a focused image when an element receives focus and an
  unfocused image after it loses focus.

When `--page-screenshot` is omitted, HTML output defaults to `full`; all other output
sets page capture to `none`. Explicit config or CLI values take precedence.

Focus pairs are bounded by `capture.limits`. The CLI progress display reports Tab
attempts, focus stops, completed pairs, and bytes while work runs. The final CLI report
shows complete/partial pair coverage plus skipped or failed capture totals.

`missing-focus-indicator` compares only complete pairs. If a pair is absent because of
a limit, clipping problem, animation, or capture failure, that element receives no
pixel-diff result. The rule can still apply its much narrower inline-style heuristic.

```bash
npx keylens audit https://example.com \
  --screenshots --page-screenshot viewport --output cli,json
```

### Experimental interactions

`--interactions` enables the config-defined policy. Defaults are a maximum of 20 cases,
2 seconds per focus/activation operation, `click` only, page reload before each case,
blocked top-level navigation, and destructive-control exclusion.

Detailed outcomes are stored in `interactionResults`:

- `passed`: focus stayed on the control or moved to a visible interactive/managed target;
- `failed`: focus was lost or moved to an invalid target;
- `skipped`: excluded/destructive/over-limit case or blocked navigation;
- `error`: the element disappeared or the action failed.

The CLI summarizes errors but intentionally truncates detail. Generate JSON and inspect
`interactionResults[]` and `crawl.interactions` for status, stable reason, message,
action, resulting focus, and duration.

### Reports

| Reporter   | File                                                                 |
| ---------- | -------------------------------------------------------------------- |
| `cli`      | stdout                                                               |
| `json`     | `keylens-report.json`                                                |
| `html`     | `keylens-report.html`                                                |
| `markdown` | `keylens-report.md`, or `keylens-report-multi.md` for multiple pages |

The JSON reporter omits binary assets and screenshot asset IDs. Use the programmatic
projection APIs when inline bytes or external references are required.

### `keylens init`

Creates or overwrites `keylens.config.json` with a concise starter configuration.

### `keylens mcp`

Starts the **experimental** MCP server over stdio. See [MCP server](./mcp).

## Exit codes

| Code | Meaning                                                                                                       |
| ---: | ------------------------------------------------------------------------------------------------------------- |
|  `0` | Complete audit with no error-severity violations                                                              |
|  `1` | Complete audit with at least one error-severity accessibility violation                                       |
|  `2` | Audit incomplete because of configuration, navigation, timeout, reporter, runtime, or rule evaluation failure |

Warnings alone return `0`. A rule evaluator error takes precedence over accessibility
violations and returns `2`; inspect `summary.errors`, rule `status: "error"`, and the
incomplete score marker.
