# Getting started

Keylens verifies runtime keyboard navigation. Static analyzers answer whether markup
could be accessible; Keylens launches a real browser, presses Tab, and records what
actually happens.

## Requirements

- Node.js 22 or later
- A Playwright-supported operating system

Keylens is distributed from the public npm registry.

## Install

```bash
npm install --save-dev @progress/keylens
npx playwright install chromium
```

The second command downloads the Chromium browser used by the default audit. If you
plan to use `--browser firefox` or `--browser webkit`, install that Playwright browser
instead.

Without installing, run Keylens with the full package name, `npx @progress/keylens`. After
the local install, `npx keylens` also works because npx uses the project's binary. The
bare `keylens` name on npm is a placeholder that only prints a warning.

## Run the first audit

```bash
npx @progress/keylens audit https://example.com
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

The command exits with code `0` when the audit completes without error-severity
violations, `1` when it finds an error-severity violation, and `2` when the audit is
incomplete because of an operational or reporting failure. See [CLI reference](./cli#exit-codes)
for the full behavior.

## Save reports

```bash
npx @progress/keylens audit https://example.com \
  --output cli,json,html,markdown \
  --output-dir ./keylens-report
```

HTML output requests a full-page screenshot by default so it can draw a focus map.
JSON omits binary assets. See [CLI reference](./cli) for filenames and exit codes.

## Create a reusable configuration

Use the initializer instead of creating the full configuration shape by hand:

```bash
npx @progress/keylens init
npx @progress/keylens audit --config keylens.config.json
```

Review the generated file before committing it. Add the URL, choose reporters, and
adjust the profile or preparation settings for your application. See
[Configuration and profiles](./configuration) for the available options and
precedence rules.

## Audit an SPA

```bash
npx @progress/keylens audit https://example.com/app \
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
npx @progress/keylens audit --config keylens.config.json
```

A CLI URL argument takes precedence over the config file's `url`.

## Telemetry and privacy

Published builds may send one anonymous aggregate event per audit to help improve
Keylens. The event does not include the audited URL, page content, selectors,
accessible names, screenshots, or report contents. See [Telemetry and privacy](./telemetry)
for opt-out options and the complete data description.

## Next steps

- [Configuration and profiles](./configuration)
- [Programmatic API](../api/)
- [CI/CD](./ci-cd)
- [Known limitations](./limitations)
- [Rules](../rules/)
- [Telemetry and privacy](./telemetry)
