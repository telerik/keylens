# GA contract migration

The current prerelease contains the intended stable deterministic core contracts.
Keylens `1.0.0` has not been published, and distribution remains on GitHub Packages.
AI and MCP remain experimental.

This guide covers integrations written against earlier `0.x` behavior.

## Configuration input

Pass nested partial options directly:

```ts
const report = await auditBase(url, {
  viewport: { width: 1440 },
  rules: { skipLink: false },
  capture: { page: "none" },
});
```

Do not spread and mutate `DEFAULT_CONFIG`. Input is strictly validated; unknown keys
fail with `CONFIG_ERROR`.

Replace legacy boolean/flat shapes:

| Earlier shape               | Current shape                |
| --------------------------- | ---------------------------- |
| `captureElementScreenshots` | `capture.elements`           |
| `interactions: true`        | `interactions.enabled: true` |

The earlier shapes are not accepted by the current strict config schema.

## No implicit programmatic output

Earlier examples expected `audit()` or reporter config to write files. Analysis now
returns an in-memory report only:

```ts
const report = await audit(url, { reporters: ["json"] });
await renderAuditReport(report, ["json"], "./keylens-report");
```

Use string renderers when no filesystem side effect is desired.

## Staged pipeline

- `auditBase()` / `auditMultipleBase()`: deterministic crawl and rules.
- `enrichAudit()` / `enrichMultiPageAudit()`: immutable experimental AI enrichment.
- `renderAuditReport()` / `renderMultiPageReport()`: explicit output.
- `audit()` / `auditMultiple()`: in-memory convenience pipeline.

Programmatic logging defaults to `silent`; pass `logLevel` explicitly for diagnostics.

## Reports and assets

Reports now include `schemaVersion`, sanitized effective config, phase timings, typed
rule status, deterministic score completeness, capture summaries, and optional
interaction detail. Treat `schemaVersion`, not package version, as the serialized
contract version.

Screenshots are `AuditAsset` records referenced by IDs. JSON serializers project assets
with `omit`; use `projectAuditReport()` or `projectMultiPageReport()` to request
`inline` or caller-supplied `references`.

## Failures, cancellation, and progress

Operational errors use `KeylensError` codes and phase metadata. Rule evaluator failures
are not violations: they use rule `status: "error"`, increment `summary.errors`, make
the score incomplete, and produce CLI exit code `2`.

Pass `signal`, `timeouts`, and `onEvent` through `AuditOptions`. Rendering has separate
`RenderOptions`. Multi-page work reuses a browser with bounded concurrency.

## Screenshots and interactions

Page capture is now explicit with `capture.page`. The CLI chooses `full` only when HTML
output needs it; programmatic defaults are `none`.

Element screenshots and interactions are bounded. Interactions are experimental,
disabled by default, and produce explicit passed, failed, skipped, or error outcomes.
Review [Configuration](./configuration) and [Known limitations](./limitations) before
enabling them in CI.

## Package subpaths

- `@telerik/keylens`: Node CLI/library surface.
- `@telerik/keylens/guidance`: browser-safe remediation and WCAG catalog.
- `@telerik/keylens/mcp`: experimental stdio server entry point.

No public npm cutover or `1.0.0` availability is implied by these contracts.
