# CLI reference

## Commands

### `keylens audit [url]`

Alias: `keylens scan [url]`. An HTTP(S) URL can also be passed directly as shorthand.
The URL argument overrides `url` from the config file. Without an argument, the
configured `url` is audited.

| Option                          | Default                | Description                                               |
| ------------------------------- | ---------------------- | --------------------------------------------------------- |
| `-c, --config <path>`           | —                      | JSON config path                                          |
| `--profile <profile>`           | `balanced`             | `fast`, `balanced`, or `thorough`                         |
| `-o, --output <reporters>`      | `cli`                  | Comma-separated `cli,json,html,markdown`                  |
| `-d, --output-dir <dir>`        | `./keylens-report`     | File reporter destination                                 |
| `-b, --browser <browser>`       | `chromium`             | `chromium`, `firefox`, or `webkit`                        |
| `--headed`                      | `false`                | Show the browser                                          |
| `--wait-for <selector>`         | —                      | Wait for a CSS selector before the fixed delay            |
| `--wait <ms>`                   | profile value          | Fixed delay after load                                    |
| `--keep-overlays`               | `false`                | Skip auto-dismissing cookie/consent banners               |
| `--no-expand-scroll-containers` | `false` (expansion on) | Skip neutralizing full-page "faux scroll" containers      |
| `--dismiss <selector>`          | —                      | Extra selector to click before the crawl (repeatable)     |
| `--consent <preference>`        | `reject`               | `reject`, `accept`, or `close` — preferred consent action |
| `--max-tabs <n>`                | profile value          | Maximum Tab attempts                                      |
| `--tab-delay <ms>`              | profile value          | Delay after each Tab; minimum 10 ms                       |
| `--viewport <WxH>`              | `1280x720`             | Browser viewport                                          |
| `--timeout <ms>`                | `30000`                | Navigation timeout                                        |
| `--page-screenshot <mode>`      | capability-based       | `none`, `viewport`, or `full`                             |
| `--screenshots`                 | `false`                | Capture bounded focus-state pairs                         |
| `--interactions`                | `false`                | Enable experimental bounded activations                   |
| `--ai`                          | `false`                | Enable experimental AI                                    |
| `--ai-model <model>`            | provider default       | Override the AI model                                     |
| `--ai-provider <provider>`      | `anthropic`            | `anthropic` or `openai`                                   |
| `--ai-base-url <url>`           | —                      | OpenAI-compatible or Azure endpoint                       |
| `-q, --quiet`                   | `false`                | Suppress nonessential output                              |
| `-v, --verbose`                 | `false`                | Enable debug diagnostics                                  |

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

`missing-focus-indicator` always runs via a computed-style diff (outline, box-shadow,
border, background, color, pseudo-elements, and parent styles) taken while each
element was focused vs. once focus moved away — no flag required. `--screenshots`
is a separate, opt-in capture used only by the AI focus-indicator-quality feature to
score the contrast/visibility of indicators already confirmed present.

```bash
npx keylens audit https://example.com \
  --screenshots --page-screenshot viewport --output cli,json
```

### Full-page "faux scroll" containers

Some sites (parallax/smooth-scroll landing pages) never scroll `<html>`/`<body>` at
all — instead, a single inner `overflow: auto` wrapper does all the scrolling, so
`document.scrollHeight` (and Playwright's own `fullPage` screenshot) stays stuck at one
viewport tall even though the real page is much longer. Keylens detects this pattern
during the prepare phase and neutralizes the container's `overflow`/`height` so the
document expands to its true length — fixing both `--page-screenshot full` captures and
the HTML focus-map overlay's marker positions.

This is **on by default**; disable it with `--no-expand-scroll-containers` (or
`prepare.expandScrollContainers: false` in a config file) if the heuristic ever
misidentifies a legitimate scrollable region (e.g. a code sample viewer) as the page
container. A detected container is reported via `crawl.prepare.scrollContainerExpanded`
in the JSON report, and as "Scroll container expanded" in the CLI/Markdown/HTML reports.

### Cookie/consent banners

Before the tab crawl starts, Keylens runs a bounded **prepare phase** that dismisses
cookie/consent banners so they don't dominate the recorded focus sequence. Built-in
presets cover the major CMPs (OneTrust, Cookiebot, Usercentrics, Didomi, TrustArc,
Quantcast, Osano, CookieYes, Termly, Klaro, Complianz, Iubenda, HubSpot, Sourcepoint,
Axeptio); a generic heuristic handles the rest. This is **on by default** — no flags
required for `npx keylens audit https://example.com` to work cleanly against a
banner-heavy site.

- `--consent reject|accept|close` picks which action is preferred when a banner offers
  more than one (default `reject`, so audits never silently opt into tracking).
- `--dismiss <selector>` adds a custom selector to click (repeatable) — useful for
  in-house banners, newsletter modals, or app tours not covered by a preset.
- `--keep-overlays` disables auto-dismissal entirely, e.g. to audit the banner itself.
- `prepare.cookies` and `prepare.steps` (config file only) set cookies before
  navigation or run generic `click`/`press`/`wait`/`waitFor` steps — see
  [Configuration](./configuration#prepare).

Every dismissal (or failure to dismiss) is reported, never silent: check `crawl.prepare`
in the JSON report, or the "Overlays dismissed" / "Prepare warnings" lines in the CLI,
HTML, and Markdown reports.

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
