# Reporters and output

Keylens separates the audit from its output. The audit produces an in-memory report;
reporters turn that report into a format for a person, a CI system, or another tool.
Select one or more reporters with `--output`:

```bash
npx keylens audit https://example.com --output cli,json
```

## Choose a reporter

| Reporter   | Best for                                          | Output                     |
| ---------- | ------------------------------------------------- | -------------------------- |
| `cli`      | Local feedback and quick checks                   | Terminal stdout            |
| `json`     | CI, dashboards, and custom tooling                | Machine-readable JSON file |
| `html`     | Visual investigation and sharing evidence         | Interactive HTML file      |
| `markdown` | Pull requests, issue reports, and agent workflows | Markdown file              |

You can combine reporters. A common CI setup is `cli,json`; use `cli,json,html` when
the CI job should also upload a visual artifact.

## CLI reporter

The CLI reporter writes a concise summary to stdout. It is useful for local work and
for showing the result directly in CI logs. Use `--quiet` to suppress nonessential
output or `--verbose` to include debug diagnostics.

The process exit code is independent of the selected output format:

- `0`: the audit completed without error-severity violations;
- `1`: the audit completed and found at least one error-severity violation;
- `2`: the audit was incomplete or a reporter failed.

## JSON reporter

JSON is the machine-readable report for CI integrations, dashboards, and custom
post-processing. It includes rule results, violations, crawl coverage, preparation
events, capture status, interaction results, and score completeness.

Binary screenshot assets are omitted by default from CLI JSON output. This keeps CI
artifacts compact and prevents image bytes from being embedded unexpectedly. Use the
programmatic asset projection APIs when a consumer needs inline assets or asset
references.

## HTML reporter

HTML is a standalone, interactive report intended for human investigation. It can
include:

- an overview of audit status, coverage, and score;
- expandable rule results and violation details;
- a focus-order map with clickable markers;
- focused-element details and source selectors;
- captured page evidence when screenshots are available;
- light/dark theme switching.

When no page-screenshot mode is specified, HTML output requests a full-page screenshot
by default so the focus map has a page image to annotate. Use `--page-screenshot none`
when a visual page capture is not needed.

```bash
npx keylens audit https://example.com \
  --output html \
  --page-screenshot full
```

### Customize HTML colors

The generated HTML is self-contained and defines its palette with CSS custom
properties in `:root`. The main variables are:

| Variable                                | Purpose                       |
| --------------------------------------- | ----------------------------- |
| `--klr-background`                      | Main report background        |
| `--klr-background-alt`                  | Cards and secondary surfaces  |
| `--klr-border`                          | Borders and separators        |
| `--klr-text`                            | Primary text                  |
| `--klr-text-subtle`                     | Secondary text                |
| `--klr-text-muted`                      | Muted metadata                |
| `--klr-accent`                          | Links and interactive accents |
| `--klr-accent-on-bg`                    | Contrast-adjusted accent      |
| `--klr-success` / `--klr-success-on-bg` | Passing states                |
| `--klr-warning` / `--klr-warning-on-bg` | Warning states                |
| `--klr-error` / `--klr-error-on-bg`     | Error states                  |

The report does not currently expose a CLI flag or config property for injecting a
custom stylesheet. To customize a generated report, append an override after the
report's existing `<style>` block:

```html
<style>
  :root {
    --klr-background: #101827;
    --klr-background-alt: #172235;
    --klr-accent: #8ab4ff;
  }
</style>
```

The report's built-in theme toggle changes `color-scheme` and the active background
automatically. Keep custom colors readable in both light and dark modes if the report
will be shared with multiple users.

## Markdown reporter

Markdown is a compact, text-only report for pull requests, issue comments, run
summaries, and agent workflows. It preserves findings, rule status, coverage,
preparation warnings, and remediation context without requiring a browser. It does
not contain the interactive focus map or screenshot assets.

## File names and destinations

File reporters write to `./keylens-report` by default:

```text
keylens-report-2026-01-15T09-30-00.json
keylens-report-2026-01-15T09-30-00.html
keylens-report-2026-01-15T09-30-00.md
```

Use these options to control the files:

```bash
npx keylens audit https://example.com \
  --output json,html \
  --output-dir ./artifacts/keylens \
  --output-name homepage-audit \
  --no-timestamp
```

- `--output-dir` selects the destination directory.
- `--output-name` selects the base name.
- `--no-timestamp` prevents the timestamp suffix.
- Multiple file reporters write one file per selected format.

Timestamps are enabled by default so repeated audits do not silently overwrite
previous reports. If a reporter cannot write its output, the audit is incomplete and
returns exit code `2`.

## Programmatic rendering

The programmatic API exposes the same output formats:

```ts
import {
  audit,
  renderAuditReport,
  renderHTML,
  renderMarkdown,
  serializeJSON,
} from "@progress/keylens";

const report = await audit("https://example.com");

await renderAuditReport(report, ["json", "html"], "./keylens-report");

const json = serializeJSON(report);
const html = renderHTML(report);
const markdown = renderMarkdown(report);
```

`renderAuditReport()` writes or prints selected reporters. The standalone render
functions return strings and do not write files.
