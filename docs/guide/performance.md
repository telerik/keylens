# Performance and resource budgets

Keylens performance is primarily driven by Tab count and delay, page settling,
page screenshots, interactions, browser engine, and number of URLs. Accuracy and runtime are
therefore explicit tradeoffs rather than one universal “fast” setting.

## Execution profiles

Use `fast` for local smoke checks, `balanced` for general use, and `thorough` for pages
that need longer focus settling. Profiles change only crawl timing and maximum Tab
attempts. See the exact values in [Configuration](./configuration#execution-profiles).

Explicit capture, interaction, timeout, and concurrency budgets still apply to every
profile.

## Resource controls

- `maxTabs` bounds Tab attempts.
- `tabTimeout` bounds an individual Tab operation; a timeout is logged and the crawl
  continues to the next attempt.
- `maxDimension`, `maxPixels`, and `maxBytes` bound image dimensions and cumulative
  capture resources.
- `interactions.maxCases` and `interactions.timeout` bound experimental activations.
- `timeouts` enforce total and phase wall-clock deadlines.

Limits degrade capture or interaction coverage where documented; total and phase
timeouts abort the operation. Inspect coverage rather than assuming a completed process
collected every optional artifact.

## Capture cost

Page screenshots are optional. A non-HTML CLI audit captures no
page image by default. HTML output requests a full-page image unless
`--page-screenshot` or `capture.page` says otherwise.

Page images retain inline assets in the in-memory report. JSON serialization omits
assets, but capture still consumes time and memory before serialization. Use
`projectAuditReport({ assets: "omit" })` for compact programmatic payloads.

## Benchmark harness

Repository contributors can run the deterministic local harness:

```bash
npm run --silent benchmark
```

It prints machine-readable JSON and writes no report artifacts. Its fixtures cover a
standard page and interactions. The harness uses
aggressive timing to expose implementation overhead; it is not a recommended audit
profile.

CI runs `npm run benchmark:ci`, writes `benchmark-results.json`, and rejects
order-of-magnitude regressions against conservative ceilings:

| Scenario     | Wall time | RSS increase | Compact payload | Inline images |
| ------------ | --------: | -----------: | --------------: | ------------: |
| Standard     |      15 s |       256 MB |          512 KB |           n/a |
| Interactions |      30 s |       256 MB |            1 MB |           n/a |

These are regression alarms, not product performance guarantees. Runtime configuration
limits remain the authoritative per-audit bounds.
