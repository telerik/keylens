# Programmatic API

The root `@telerik/keylens` export is ESM-only and requires Node.js 26 or later.
Programmatic analysis is silent and in-memory by default: reporter settings may be
retained in `report.config`, but no terminal output or files are produced until a
renderer is called.

## Deterministic analysis

```ts
import { auditBase } from "@telerik/keylens";

const report = await auditBase("https://example.com", {
  profile: "balanced",
  capture: { page: "none", elements: false },
  timeouts: { total: 60_000, crawl: 45_000, rules: 10_000 },
});

if (report.summary.errors > 0) {
  throw new Error("Audit is incomplete");
}
```

`auditBase(url, options)` runs the crawl and enabled deterministic rules only.

Nested options are partial; do not spread `DEFAULT_CONFIG`.

`audit()` is a convenience pipeline. It runs deterministic analysis but does not render
or write output.

`crawlOnly()` is a lightweight crawl path intended for specialized experimental
adapters; prefer the audit APIs for stable integrations.

## Explicit rendering

```ts
import {
  renderAuditReport,
  renderHTML,
  renderMarkdown,
  serializeJSON,
} from "@telerik/keylens";

await renderAuditReport(report, ["json", "html"], "./keylens-report", {
  timeout: 15_000,
});

const json = serializeJSON(report);
const html = renderHTML(report);
const markdown = renderMarkdown(report);
```

- `renderAuditReport()` prints/writes selected reporters.
- `serializeJSON()` returns semantic JSON with assets omitted.
- `renderHTML()` and `renderMarkdown()` return strings without writing.
- Render functions accept an `AbortSignal`; file renderers also honor the reporter
  timeout from `RenderOptions` or `config.timeouts.reporters`.

Report file names are `keylens-report.json`, `keylens-report.html`, and
`keylens-report.md`.

## Assets and projections

Captured images are `AuditAsset` entries referenced by IDs from the report. Choose an
asset projection deliberately:

```ts
import { projectAuditReport } from "@telerik/keylens";

const semantic = projectAuditReport(report, { assets: "omit" });
const selfContained = projectAuditReport(report, { assets: "inline" });
const referenced = projectAuditReport(report, {
  assets: "references",
  reference(asset) {
    return { kind: "file", path: `./assets/${asset.id}.png` };
  },
});
```

- `omit` removes assets and screenshot IDs.
- `inline` clones all inline data.
- `references` replaces inline storage metadata by calling `reference`; it does not
  write asset files for you.

The JSON reporter uses `omit`. Asset capture itself is controlled by `capture`, not by
the projection.

## Cancellation, deadlines, and progress

```ts
import { auditBase, KeylensError } from "@telerik/keylens";

const controller = new AbortController();

try {
  await auditBase("https://example.com", {
    signal: controller.signal,
    timeouts: {
      total: 90_000,
      crawl: 60_000,
      rules: 10_000,
      interactions: 20_000,
    },
    onEvent(event) {
      if (event.type === "crawl-progress") {
        console.log(event.tabsAttempted, event.maxTabs, event.elementsFocused);
      }
    },
  });
} catch (error) {
  if (error instanceof KeylensError) {
    console.error(error.code, error.phase, error.url, error.retryable);
  }
}
```

`AuditEvent` includes phase start/completion, crawl progress, rule start/completion,
asset capture, interaction progress/completion, and warnings. Events include an ISO
timestamp, elapsed milliseconds, phase, and optional URL.

Owned browser resources close after success, error, timeout, or abort. A total timeout
wraps the complete analysis call; phase timeouts bound crawl, rules, interactions, and
reporters where applicable.

## Errors and incomplete scores

All operational errors derive from `KeylensError` and expose a stable `code`, `phase`,
optional URL, retryability, details, and serializable `toJSON()` form. Codes are:

`ABORTED`, `TIMEOUT`, `CONFIG_ERROR`, `CRAWL_ERROR`, `NAVIGATION_ERROR`,
`RULE_ERROR`, `REPORTER_ERROR`, and `INTERNAL_ERROR`.

Individual rule evaluator failures are represented as `RuleResult.status === "error"`
with `error.code === "RULE_ERROR"`. They increment `summary.errors` and set
`summary.scoreComplete` to `false`; they are not accessibility violations.

## Reports

Every `AuditReport` includes:

- `schemaVersion`, package `version`, timestamp, URL, and sanitized effective config;
- phase timings and crawl coverage;
- rule results and deterministic summary;
- capture summary, optional focus sequence, interaction outcomes, and assets.

## Browser-safe guidance

The `@telerik/keylens/guidance` subpath does not import Playwright and is suitable for
browser bundles:

```ts
import {
  getRuleCatalog,
  getRuleRemediation,
  getWcagReference,
} from "@telerik/keylens/guidance";
```

The `@telerik/keylens/mcp` subpath is experimental and starts the stdio server as a
side effect; do not import it as a general library module.
