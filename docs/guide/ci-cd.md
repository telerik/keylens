# CI/CD Integration

Keylens is designed for CI pipelines. It exits with code `1` when errors are found, and code `0` when the audit passes.

## GitHub Actions

```yaml
name: Accessibility
on: [push, pull_request]

jobs:
  keyboard-a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm start &
      - run: npx wait-on http://localhost:3000
      - run: npx @telerik/keylens audit http://localhost:3000 --output json
```

## Using JSON Output

The JSON report (`keylens-report.json`) can be parsed by other tools or uploaded as a CI artifact:

```yaml
- run: npx @telerik/keylens audit http://localhost:3000 --output json -d ./reports
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: keylens-report
    path: ./reports/
```

## Using Markdown Output

The Markdown reporter generates a portable `keylens-report.md` (or `keylens-report-multi.md` for multi-page audits) that renders natively in GitHub PR comments, wiki pages, and issue bodies:

```yaml
- run: npx @telerik/keylens audit http://localhost:3000 --output markdown -d ./reports
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: keylens-markdown-report
    path: ./reports/
```

## Exit Codes

| Code | Meaning             |
| ---- | ------------------- |
| `0`  | Audit passed        |
| `1`  | Errors found        |
| `2`  | Audit failed to run |
