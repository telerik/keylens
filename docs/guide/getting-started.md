# Getting started

Keylens verifies runtime keyboard navigation. Static analyzers answer whether markup
could be accessible; Keylens launches a real browser, presses Tab, and records what
actually happens.

## Requirements

- Node.js 20 or later (verified on 20, 22, 24, and 26)
- A Playwright-supported operating system

Keylens is distributed from the public npm registry as a prerelease; `1.0.0` is not
published yet.

## Install

```bash
npm install --save-dev @telerik/keylens@dev
npx playwright install chromium
```

The `@dev` tag is the current prerelease channel.

## Run the first audit

```bash
npx keylens audit https://example.com
```

By default, Keylens:

1. starts headless Chromium;
2. loads the page at `domcontentloaded`, then waits 1 second;
3. tests the first five focus stops for a skip link;
4. discovers interactive elements in the top-level document;
5. presses Tab until focus cycles or the `balanced` profile reaches 500 attempts;
6. evaluates nine deterministic rules;
7. prints a CLI report.

No page screenshot is captured by the default CLI report, and controls are not
activated.

## Save reports

```bash
npx keylens audit https://example.com \
  --output cli,json,html,markdown \
  --output-dir ./keylens-report
```

HTML output requests a full-page screenshot by default so it can draw a focus map.
JSON omits binary assets. See [CLI reference](./cli) for filenames and exit codes.

## Audit an SPA

```bash
npx keylens audit https://example.com/app \
  --wait-for "[data-app-ready]" \
  --wait 1500
```

`--wait-for` waits for the selector using `tabTimeout`; `--wait` then adds a fixed
settling delay. Neither option proves that all later lazy content or application states
have loaded. Audit significant routes and states separately.

## Audit using a config file

```json
{
  "url": "https://example.com/",
  "reporters": ["cli", "json"]
}
```

```bash
npx keylens audit --config keylens.config.json
```

A CLI URL argument takes precedence over the config file's `url`.

## Next steps

- [Configuration and profiles](./configuration)
- [Programmatic API](/api/)
- [CI/CD](./ci-cd)
- [Known limitations](./limitations)
- [Rules](/rules/)
- [Telemetry and privacy](https://github.com/telerik/keylens/blob/develop/src/telemetry/README.md)
