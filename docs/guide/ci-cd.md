# CI/CD integration

Keylens has three stable exit classes:

| Code | CI interpretation                                                          |
| ---: | -------------------------------------------------------------------------- |
|  `0` | Complete audit; no error-severity violations                               |
|  `1` | Complete audit; accessibility errors found                                 |
|  `2` | Incomplete audit; configuration, runtime, timeout, reporter, or rule error |

Warnings alone do not fail the job. Do not collapse codes `1` and `2`: code `1` is a
valid test result, while code `2` means the result is not complete enough to trust.

## Install in CI

Keylens is distributed through the public npm registry; no authentication is
required to install it.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm ci
```

## GitHub Actions example

```yaml
name: Keyboard accessibility

on: [push, pull_request]

jobs:
  keylens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run start &
      - run: npx --no-install wait-on http://127.0.0.1:3000
      - name: Audit keyboard navigation
        run: >-
          npx keylens audit http://127.0.0.1:3000
          --profile balanced
          --output cli,json
          --output-dir ./keylens-report
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: keylens-report
          path: ./keylens-report/
```

`wait-on` must already be a project dependency for `npx --no-install` to use it; add it
to `devDependencies` or replace that step with the project's existing server-readiness
command. Pin package versions in the project lockfile rather than downloading an
unpinned CLI during the job.

Report file names include a `-YYYY-MM-DDTHH-mm-ss` timestamp by default, so a script
that reads a fixed path (rather than uploading the whole directory, as above) should
pass `--no-timestamp` for a stable `keylens-report.json`.

## Inspecting JSON

The JSON report omits binary assets but retains semantic coverage:

- `summary.totalErrors`: accessibility errors;
- `summary.errors`: rule evaluators that failed;
- `summary.scoreComplete`: whether all enabled rules were evaluated;
- `crawl.cycleCompleted`: whether focus returned to the first stop;
- `crawl.capture`: captured, skipped, and failed asset totals;
- `crawl.interactions`: aggregate interaction outcomes;
- `interactionResults`: each passed, failed, skipped, or error interaction case.

Archive JSON even when the command exits nonzero. Treat `scoreComplete: false`, capture
omissions, an incomplete Tab cycle, and interaction errors as coverage signals, not as
passes.

## Stable pages and budgets

For repeatable CI:

- audit a locally served, production-like build;
- wait for an application-ready selector;
- freeze or mock changing content;
- use an explicit viewport and browser;
- set `timeouts.total` and relevant phase budgets;
- use `capture.limits` and interaction limits;
- audit multiple browsers in separate jobs when cross-browser behavior matters.

See [Configuration](./configuration) and [Known limitations](./limitations).
