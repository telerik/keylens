---
name: keylens
description: Run keyboard navigation accessibility audits on web pages using a real browser.
user-invokable: true
argument-hint: "[url] [--screenshots] [--interactions] [--ai] [--tab-delay <ms>]"
license: MIT
compatibility: VS Code with terminal access
metadata:
  author: Telerik
  version: "0.1.0"
---

# Keylens - Keyboard Navigation Testing

## Quick Start

1. Check if keylens is installed:

   ```bash
   npx keylens --version
   ```

   If not installed, the user needs: `npm install -g @telerik/keylens && npx playwright install chromium`

2. Run a basic audit:

   ```bash
   npx keylens audit <URL> --output cli,json --output-dir ./keylens-report
   ```

3. Read the JSON report for structured results:
   ```bash
   cat ./keylens-report/keylens-report.json
   ```

## Common Workflows

### Full audit with AI analysis

```bash
npx keylens audit <URL> --ai --output cli,json,html --output-dir ./keylens-report
```

### Audit with screenshot-based focus indicator detection

```bash
npx keylens audit <URL> --screenshots --output cli,json
```

### Audit with interaction testing (button click focus retention)

```bash
npx keylens audit <URL> --interactions --output cli,json
```

### Multi-page audit from config

```bash
npx keylens audit --config keylens.config.json --output cli,json,html
```

### Mobile viewport

```bash
npx keylens audit <URL> --viewport 375x667
```

### Markdown report for LLM piping

```bash
npx keylens audit <URL> --output markdown --output-dir ./keylens-report
cat ./keylens-report/keylens-report.md
```

## Reading Results

The JSON report contains:

- `summary.totalErrors` / `summary.totalWarnings` — counts by severity
- `rules[]` — per-rule pass/fail with violations
- `crawl.totalFocusableElements` / `crawl.unreachedElements` — coverage
- `widgetClassifications[]` — AI widget pattern identification (when --ai)
- `aiFocusOrderAnalysis` — AI focus order assessment (when --ai)

## Key Rules

| Rule                    | WCAG   | What it checks                             |
| ----------------------- | ------ | ------------------------------------------ |
| keyboard-trap           | 2.1.2  | Elements that trap focus                   |
| unreachable-elements    | 2.1.1  | Interactive elements never reached via Tab |
| focus-order-mismatch    | 2.4.3  | Tab order vs visual layout divergence      |
| missing-focus-indicator | 2.4.7  | Invisible focus styles                     |
| skip-link               | 2.4.1  | Skip navigation presence and function      |
| focus-not-obscured      | 2.4.11 | Focused elements hidden by overlays        |
| focus-after-interaction | 2.4.3  | Focus lost after clicking buttons          |
| tabindex-abuse          | 2.4.3  | Positive tabindex values                   |

See [rules reference](references/rules.md) for details on each rule.
See [fix patterns](references/fix-patterns.md) for code-level solutions.

## Exit Codes

- **0**: All rules passed
- **1**: At least one error-severity violation found
- **2**: Audit failed (bad URL, config error, browser issue)
