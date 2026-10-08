# CLI reference

## Commands

### `keylens audit [url]`

Alias: `keylens scan [url]`. An HTTP(S) URL can also be passed directly as shorthand.
The URL argument overrides `url` from the config file. Without an argument, the
configured `url` is audited.

| Option                          | Default                | Description                                                                                                                                                |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-c, --config <path>`           | —                      | Load a JSON configuration file. CLI values override values from this file; without this flag, Keylens looks only for a URL argument.                       |
| `--profile <profile>`           | `balanced`             | Select `fast`, `balanced`, or `thorough` defaults for tab count, tab settling, and post-load wait. Explicit flags and config values override the profile.  |
| `-o, --output <reporters>`      | `cli`                  | Select one or more comma-separated reporters: `cli`, `json`, `html`, or `markdown`. File reporters write artifacts; `cli` writes to stdout.                |
| `-d, --output-dir <dir>`        | `./keylens-report`     | Choose the directory for JSON, HTML, and Markdown files. It has no effect on terminal-only output.                                                         |
| `--output-name <name>`          | `keylens-report`       | Set the base filename for file reports. Extensions and the timestamp suffix are added automatically.                                                       |
| `--no-timestamp`                | `false` (timestamp on) | Remove the timestamp suffix from file reports. Repeated runs then overwrite files with the same name.                                                      |
| `-b, --browser <browser>`       | `chromium`             | Choose the Playwright engine: `chromium`, `firefox`, or `webkit`. Use the same engine as your supported user environment when behavior differs by browser. |
| `--headed`                      | `false`                | Run with a visible browser window instead of headless mode. Useful for local debugging; CI environments usually require headless mode.                     |
| `--wait-for <selector>`         | —                      | Wait for a CSS selector to appear before the profile's fixed post-load delay. Use this for an app-ready marker or asynchronously rendered shell.           |
| `--wait <ms>`                   | profile value          | Set the fixed delay after page load and after `--wait-for` resolves. Use it for animations or late content that has no reliable ready selector.            |
| `--keep-overlays`               | `false`                | Keep cookie/consent banners and other automatically detected overlays so the audit can test them. Custom `--dismiss` selectors still run.                  |
| `--no-expand-scroll-containers` | `false` (expansion on) | Disable the heuristic that expands full-page faux-scroll containers. Use this when an inner scroll region must remain a legitimate scrollable region.      |
| `--dismiss <selector>`          | —                      | Click an additional CSS selector before the crawl. Repeat the option for multiple selectors, such as a custom tour or newsletter modal close button.       |
| `--consent <preference>`        | `reject`               | Choose the preferred banner action: `reject`, `accept`, or `close`. `reject` avoids silently opting into tracking during an audit.                         |
| `--max-tabs <n>`                | profile value          | Set the maximum number of Tab attempts. Increase it for pages with long or dynamically revealed focus sequences; it bounds audit time and coverage.        |
| `--tab-delay <ms>`              | profile value          | Set the delay after each Tab so focus and layout changes can settle. The minimum is 10 ms; increase it for animated or highly dynamic interfaces.          |
| `--viewport <WxH>`              | `1280x720`             | Set the browser viewport, for example `1440x900`. This affects responsive layout, visibility, overlays, and focus-obscured checks.                         |
| `--timeout <ms>`                | `30000`                | Set the navigation timeout in milliseconds. This covers page navigation, not the total audit budget or every crawl phase.                                  |
| `--page-screenshot <mode>`      | capability-based       | Capture no image, the viewport, or the full page with `none`, `viewport`, or `full`. HTML defaults to `full`; other reporter selections default to `none`. |
| `--interactions`                | `false`                | Enable opt-in, bounded post-activation focus checks. Review the interaction policy before enabling it against stateful or destructive pages.               |
| `-q, --quiet`                   | `false`                | Suppress nonessential terminal output while preserving errors and the selected report output.                                                              |
| `-v, --verbose`                 | `false`                | Enable debug-level diagnostics, including detailed phase and browser progress information.                                                                 |

CLI values override config values. `--headed` and `--interactions` enable their
features; they do not provide `--no-*` forms.

### Page screenshots

Page screenshots are separate from the focus-indicator checks. Keylens always compares
focused and unfocused styles, and may run a targeted pixel comparison; those checks do
not require a page screenshot.

- `--page-screenshot viewport|full` captures one page image. `none` disables it.
  When `--page-screenshot` is omitted, HTML output defaults to `full`; all other output
  sets page capture to `none`. Explicit config or CLI values take precedence.

The `missing-focus-indicator` rule uses a computed-style diff (outline, box-shadow,
border, background, color, pseudo-elements, and parent styles) taken while each
element is focused and after focus moves away. A targeted pixel comparison also
confirms candidates whose visual change is not visible in style data. No screenshot
flag is required for either check.

```bash
npx @progress/keylens audit https://example.com \
  --page-screenshot viewport --output cli,json
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
presets cover common CMPs (OneTrust, Cookiebot, Usercentrics, Didomi, TrustArc,
Quantcast, Osano, CookieYes, Termly, Klaro, Complianz, Iubenda, HubSpot, Sourcepoint,
Axeptio); a generic heuristic handles the rest. This is **on by default** — no flags
required for `npx @progress/keylens audit https://example.com` to work cleanly against a
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

### Interaction testing

`--interactions` enables the policy in `interactions` from the config file. It is
opt-in because it activates real controls and can change application state. Defaults
are a maximum of 20 cases, 2 seconds per focus/activation operation, `click` only,
page reload before each case, blocked top-level navigation, and destructive-control
exclusion. See [Configuration](./configuration) for the full policy.

Detailed outcomes are stored in `interactionResults`:

- `passed`: focus stayed on the control or moved to a visible interactive/managed target;
- `failed`: focus was lost or moved to an invalid target;
- `skipped`: excluded/destructive/over-limit case or blocked navigation;
- `error`: the element disappeared or the action failed.

The CLI summarizes errors but intentionally truncates detail. Generate JSON and inspect
`interactionResults[]` and `crawl.interactions` for status, reason, message, action,
resulting focus, and duration. Interaction failures contribute to the relevant rule
result; they do not by themselves mean that the entire audit is incomplete.

### Reports

See [Reporters and output](./reporters) for format details, workflow recommendations,
and HTML report customization.

Each reporter writes a base name of `keylens-report` (or `--output-name <name>` /
`outputFileName` in a config file) with a `-YYYY-MM-DDTHH-mm-ss` timestamp appended by
default, so repeated runs against the same `--output-dir` never silently overwrite a
prior report:

| Reporter   | File                                      |
| ---------- | ----------------------------------------- |
| `cli`      | stdout                                    |
| `json`     | `keylens-report-2026-01-15T09-30-00.json` |
| `html`     | `keylens-report-2026-01-15T09-30-00.html` |
| `markdown` | `keylens-report-2026-01-15T09-30-00.md`   |

Use `--no-timestamp` (or `appendTimestamp: false` in a config file) for a stable file
name, e.g. when a CI job always reads the same known path. Use `--output-name <name>`
(or `outputFileName` in a config file) to set a custom base name instead of
`keylens-report` — useful when auditing many URLs in a loop and prefixing reports with
a per-URL slug.

The JSON reporter omits binary assets and screenshot asset IDs. Use the programmatic
projection APIs when inline bytes or external references are required.

### `keylens init`

Creates or overwrites `keylens.config.json` with a concise starter configuration.

## Exit codes

| Code | Meaning                                                                                                       |
| ---: | ------------------------------------------------------------------------------------------------------------- |
|  `0` | Complete audit with no error-severity violations                                                              |
|  `1` | Complete audit with at least one error-severity accessibility violation                                       |
|  `2` | Audit incomplete because of configuration, navigation, timeout, reporter, runtime, or rule evaluation failure |

Warnings alone return `0`. A rule evaluator error takes precedence over accessibility
violations and returns `2`; inspect `summary.errors`, rule `status: "error"`, and the
incomplete score marker.
