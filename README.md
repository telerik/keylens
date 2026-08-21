<div align="center">

# Keylens

**Press Tab. Record what actually happens.**

Static accessibility tools tell you whether markup _could_ work. Keylens launches a
real Playwright browser, presses Tab, and records the keyboard path users actually get.

[Documentation](docs/index.md) · [Getting started](docs/guide/getting-started.md) ·
[Rules](docs/rules/index.md) · [API](docs/api/index.md) ·
[Contributing](CONTRIBUTING.md)

</div>

## What Keylens tests

Keylens complements static accessibility analysis; it does not replace it. It evaluates
the runtime focus sequence with eight deterministic rules:

- keyboard traps and incomplete Tab cycles;
- interactive elements that Tab never reaches;
- large differences between visual and focus order;
- positive `tabindex` values;
- missing visual focus changes, with optional screenshot evidence;
- missing or nonfunctional skip links;
- focus obscured at the focused element's center point;
- invalid focus after bounded, opt-in activations.

It can audit multiple pages with browser reuse and bounded concurrency, emit CLI, JSON,
HTML, or Markdown reports, and run as a library with cancellation, progress events,
phase deadlines, typed errors, and explicit rendering.

Before the crawl starts, a bounded prepare phase auto-dismisses cookie/consent banners
(built-in presets for major CMPs, plus a generic fallback), so audits of real sites
aren't dominated by banner noise. Disable with `--keep-overlays`; see
[Configuration](./docs/guide/configuration.md#prepare).

> [!IMPORTANT]
> The deterministic CLI, reports, and programmatic core are the stable surface.
> AI enrichment and MCP are experimental and may change independently.

## Install from GitHub Packages

Keylens is currently distributed through GitHub Packages, not the public npm registry.
Node.js 26 or later and a GitHub token with `read:packages` are required.

```bash
gh auth login --scopes read:packages
npm config set @telerik:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken "$(gh auth token)"
npm install --save-dev @telerik/keylens@dev
npx playwright install chromium
```

The `@dev` tag is the current prerelease distribution channel. Keylens `1.0.0` is not
published.

## Run an audit

```bash
npx keylens audit https://example.com
```

The default `balanced` profile runs headless Chromium, captures no screenshots unless
an HTML report needs a page image, does not activate controls, and prints the CLI
report.

```bash
# CI-oriented JSON
npx keylens audit https://example.com --output cli,json

# HTML focus map (implicitly requests a full-page capture)
npx keylens audit https://example.com --output html

# Focus-state screenshot pairs for missing-focus-indicator evidence
npx keylens audit https://example.com --screenshots --output cli,json

# Exhaustive within explicit enforced budgets
npx keylens audit https://example.com --profile thorough \
  --screenshots --interactions --output cli,json,html,markdown \
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
import { auditBase, renderAuditReport } from "@telerik/keylens";

const controller = new AbortController();
const report = await auditBase("https://example.com", {
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

Use `auditBase()` for deterministic analysis, `enrichAudit()` for experimental AI, and
`renderAuditReport()` for output. The convenience `audit()` function still returns an
in-memory report and only enriches when AI is enabled.

The browser-safe `@telerik/keylens/guidance` subpath exposes rule remediation and WCAG
references without importing Playwright:

```ts
import { getRuleRemediation } from "@telerik/keylens/guidance";
```

## Screenshots and interactions

- `capture.page` / `--page-screenshot` controls one page image (`none`, `viewport`, or
  `full`). HTML output defaults it to `full`; other CLI output defaults it to `none`.
- `capture.elements` / `--screenshots` captures focused and unfocused element images.
  The `missing-focus-indicator` rule only performs pixel comparison when both images in
  a pair exist.
- Capture is bounded by element count, dimensions, decoded pixels, and encoded bytes.
  Reports expose skipped/failed capture totals; the CLI shows complete and partial pair
  coverage. Missing pairs degrade to the limited inline-style heuristic.
- Interactions are experimental and off by default. They are bounded, reload-isolated
  by default, skip likely destructive controls, and block top-level navigation.
  Inspect `interactionResults` in the in-memory report or JSON projection for every
  passed, failed, skipped, and errored case.

See [Known limitations](docs/guide/limitations.md) before treating results as complete
accessibility conformance evidence.

## Reports

| Reporter   | Output                                                          |
| ---------- | --------------------------------------------------------------- |
| `cli`      | Human-readable terminal report and capture coverage             |
| `json`     | `keylens-report.json`; semantic data with binary assets omitted |
| `html`     | `keylens-report.html`; focus map when a page image is available |
| `markdown` | `keylens-report.md` or `keylens-report-multi.md`                |

Reports carry an independent `schemaVersion`. A score is marked incomplete when a rule
could not be evaluated; do not compare that score as if it covered all enabled rules.

## Experimental AI and MCP

AI can add fix suggestions, visual focus-order analysis, summaries, widget
classification, name suggestions, focus-indicator scoring, and cross-page patterns.
It is nondeterministic and can send HTML snippets, element metadata, focus data, and
images to the configured provider. It is disabled by default.

The `@telerik/keylens/mcp` subpath and `keylens-mcp` binary expose experimental MCP
tools over stdio. Review [AI](docs/guide/ai.md) and [MCP](docs/guide/mcp.md) before use.

## Support and security

- [Support policy and Node/browser matrix](SUPPORT.md)
- [Security policy and private reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Migration guide](docs/guide/ga-migration.md)

## License

[MIT](LICENSE)
