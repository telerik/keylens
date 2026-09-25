<div align="center">

# Keylens

**Press Tab. Record what actually happens.**

[![npm version](https://img.shields.io/npm/v/@telerik/keylens.svg)](https://www.npmjs.com/package/@telerik/keylens)
[![npm downloads](https://img.shields.io/npm/dm/@telerik/keylens.svg)](https://www.npmjs.com/package/@telerik/keylens)
[![CI](https://github.com/telerik/keylens/actions/workflows/ci.yml/badge.svg)](https://github.com/telerik/keylens/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Static accessibility tools tell you whether markup _could_ work. Keylens launches a
real Playwright browser, presses Tab, and records the keyboard path users actually get.

[Documentation](https://telerik.github.io/keylens/) ·
[Getting started](docs/guide/getting-started.md) ·
[Rules](docs/rules/index.md) · [API](docs/api/index.md) ·
[Contributing](CONTRIBUTING.md)

</div>

## What Keylens tests

Keylens complements static accessibility analysis; it does not replace it. It evaluates
the runtime focus sequence with nine deterministic rules:

- keyboard traps and incomplete Tab cycles;
- interactive elements that Tab never reaches;
- large differences between focus order and DOM order;
- positive `tabindex` values;
- missing visual focus changes, with optional screenshot evidence;
- missing or nonfunctional skip links;
- focus obscured at the focused element's center point;
- invalid focus after bounded, opt-in activations;
- composite widgets (tabs, menus, listboxes) unreachable via arrow keys despite roving-tabindex markup.

It audits one page per invocation, emits CLI, JSON, HTML, or Markdown reports, and
runs as a library with cancellation, progress events, phase deadlines, typed errors,
and explicit rendering.

Before the crawl starts, a bounded prepare phase auto-dismisses cookie/consent banners
(built-in presets for major CMPs, plus a generic fallback), so audits of real sites
aren't dominated by banner noise. Disable with `--keep-overlays`; see
[Configuration](./docs/guide/configuration.md#prepare).

> [!IMPORTANT]
> The deterministic CLI, reports, and programmatic core are the stable surface.
> MCP distribution and interaction testing are experimental and may change independently.

## Install

Keylens is distributed through the public npm registry. Node.js 20 or later is
required (verified on 20, 22, 24, and 26).

```bash
npm install --save-dev @telerik/keylens@dev
npx playwright install chromium
```

The `@dev` tag is the current prerelease distribution channel. Keylens `1.0.0` is not
published.

## Run an audit

```bash
npx keylens audit https://example.com
```

```text
🔍 Keylens v0.1.0 — Keyboard Navigation Audit
URL: https://example.com
Focusable elements: 42
Interactive elements: 40 (2 unreachable)
Tab cycle completed: Yes
Duration: 3120ms

Rules:
● unreachable-elements   FAIL  2 interactive elements never reached via Tab
● keyboard-trap          PASS
● focus-order-mismatch   PASS
● missing-focus-indicator PASS
...

Score: 78/100
```

The default `balanced` profile runs headless Chromium, captures no screenshots unless
an HTML report needs a page image, does not activate controls, and prints the CLI
report.

```bash
# CI-oriented JSON
npx keylens audit https://example.com --output cli,json

# HTML focus map (implicitly requests a full-page capture)
npx keylens audit https://example.com --output html

# Exhaustive within explicit enforced budgets
npx keylens audit https://example.com --profile thorough \
  --interactions --output cli,json,html,markdown \
  --config keylens.config.json
```

For the last command, set capture, interaction, and timeout budgets in the config.
“Thorough” increases crawl timing and `maxTabs`; it does not remove resource limits.
See [Configuration](docs/guide/configuration.md).

## Exit codes

| Code | Meaning                                                                                            |
| ---: | -------------------------------------------------------------------------------------------------- |
|  `0` | Audit completed with no error-severity violations or rule evaluation errors                        |
|  `1` | Audit completed and found one or more error-severity accessibility violations                      |
|  `2` | Configuration, navigation, timeout, reporter, or rule evaluation failure made the audit incomplete |

Warnings alone return `0`.

## Programmatic API

Programmatic analysis is silent and in-memory by default. It does not print reports or
write files unless a renderer is called explicitly.

```ts
import { audit, renderAuditReport } from "@telerik/keylens";

const controller = new AbortController();
const report = await audit("https://example.com", {
  profile: "balanced",
  capture: { page: "none" },
  signal: controller.signal,
  timeouts: { total: 60_000, crawl: 45_000, rules: 10_000 },
  onEvent(event) {
    if (event.type === "crawl-progress") {
      console.log(event.tabsAttempted, event.elementsFocused);
    }
  },
});

await renderAuditReport(report, ["json"], "./keylens-report");
```

Use `audit()` for deterministic analysis and `renderAuditReport()` for output.

The browser-safe `@telerik/keylens/guidance` subpath exposes rule remediation and WCAG
references without importing Playwright:

```ts
import { getRuleRemediation } from "@telerik/keylens/guidance";
```

## Page screenshots and interactions

- `capture.page` / `--page-screenshot` controls one page image (`none`, `viewport`, or
  `full`). HTML output defaults it to `full`; other CLI output defaults it to `none`.
- Page capture is bounded by dimensions, decoded pixels, and encoded bytes. Reports
  expose skipped/failed capture totals.
- Interactions are experimental and off by default. They are bounded, reload-isolated
  by default, skip likely destructive controls, and block top-level navigation.
  Inspect `interactionResults` in the in-memory report or JSON projection for every
  passed, failed, skipped, and errored case.

See [Known limitations](docs/guide/limitations.md) before treating results as complete
accessibility conformance evidence.

## Reports

| Reporter   | Output                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| `cli`      | Human-readable terminal report and capture coverage                         |
| `json`     | `keylens-report-<timestamp>.json`; semantic data with binary assets omitted |
| `html`     | `keylens-report-<timestamp>.html`; focus map when a page image is available |
| `markdown` | `keylens-report-<timestamp>.md`                                             |

A `-YYYY-MM-DDTHH-mm-ss` timestamp is appended to file reporter names by default so
repeated runs against the same `--output-dir` never overwrite a prior report. Use
`--output-name <name>` for a custom base name (e.g. a per-URL prefix) or
`--no-timestamp` for a stable name.

Reports carry an independent `schemaVersion`. A score is marked incomplete when a rule
could not be evaluated; do not compare that score as if it covered all enabled rules.

## MCP distribution

The `@telerik/keylens/mcp` subpath and `keylens-mcp` binary expose the deterministic
single-page audit and rule guidance tools over stdio. Review [MCP](docs/guide/mcp.md)
before use.

## Telemetry

Keylens can collect anonymous, aggregate usage data (audit counts, options used,
pass/fail results, and accessibility issue categories), correlated with a one-way
hashed machine identifier, to help improve the tool. No URLs, page content,
selectors, accessible names, screenshots, reports, or IP addresses are ever
collected. Telemetry is enabled by default, and a one-time notice is always
shown before anything is collected. Opt out anytime with `KEYLENS_TELEMETRY_OFF=1`
or `TELERIK_TELEMETRY_OFF=1`. See
[src/telemetry/README.md](src/telemetry/README.md) for the full data-collection
policy.

## Support and security

- [Support policy and Node/browser matrix](SUPPORT.md)
- [Security policy and private reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

[Apache License 2.0](LICENSE)

Copyright 2026 Progress Software Corporation. See [NOTICE](NOTICE).
