# Performance and resource budgets

Keylens performance is primarily driven by Tab count and delay, page settling,
page screenshots, interactions, browser engine, and number of URLs. Accuracy and runtime are
therefore explicit tradeoffs rather than one universal “fast” setting.

## Execution profiles

Use `fast` for local smoke checks, `balanced` for general use, and `thorough` for pages
that need longer focus settling. Profiles change only crawl timing and maximum Tab
attempts. See the exact values in [Configuration](./configuration#execution-profiles).

Explicit capture, interaction, and timeout budgets still apply to every profile.

## Resource controls

- `maxTabs` bounds Tab attempts.
- `tabTimeout` bounds an individual Tab operation; a timeout is logged and the crawl
  continues to the next attempt.
- `maxDimension`, `maxPixels`, and `maxBytes` bound image dimensions and cumulative
  capture resources.
- `interactions.maxCases` and `interactions.timeout` bound post-activation checks.
- Configured `timeouts` enforce total and phase wall-clock deadlines.

Limits degrade capture or interaction coverage where documented; total and phase
timeouts abort the operation. Inspect coverage rather than assuming a completed process
collected every optional artifact.

## Capture cost

Page screenshots are optional. CLI, JSON, and Markdown output capture no page image by
default. HTML output requests a full-page image unless `--page-screenshot` or
`capture.page` says otherwise.

Page images retain inline assets in the in-memory report. JSON serialization omits
assets, but capture still consumes time and memory before serialization. Use
`projectAuditReport(report, { assets: "omit" })` for compact programmatic payloads.
