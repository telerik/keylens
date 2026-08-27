---
name: keylens
description: Run keyboard navigation accessibility audits on web pages using a real browser.
user-invokable: true
argument-hint: "[url] [--profile <profile>] [--interactions]"
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

   If it is not installed, explain that Keylens currently comes from GitHub
   Packages and follow the authenticated installation steps in the repository
   README. Do not assume the package is available from the public npm registry.

2. Run a basic audit:

   ```bash
   npx keylens audit <URL> --output cli,json --output-dir ./keylens-report
   ```

3. Read the JSON report for structured results:
   ```bash
   cat ./keylens-report/keylens-report.json
   ```

## Common Workflows

### Thorough deterministic audit

```bash
npx keylens audit <URL> --profile thorough --output cli,json,html
```

Execution profiles do not remove capture, interaction, or timeout budgets.

### Audit with experimental interaction testing

```bash
npx keylens audit <URL> --interactions --output cli,json
```

### Audit from config file

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
- `rules[].status` — `passed`, `failed`, or `error`; evaluator errors make the score incomplete
- `crawl.totalFocusableElements` / `crawl.unreachedElements` — coverage
- `crawl.capture` — captured, skipped, failed, byte, and pixel counts
- `interactionResults[]` — detailed passed, failed, skipped, and errored activation cases

## Key Rules

| Rule                    | WCAG   | What it checks                                      |
| ----------------------- | ------ | --------------------------------------------------- |
| keyboard-trap           | 2.1.2  | Elements that trap focus                            |
| unreachable-elements    | 2.1.1  | Interactive elements never reached via Tab          |
| focus-order-mismatch    | 2.4.3  | Tab order vs DOM order divergence                   |
| missing-focus-indicator | 2.4.7  | Invisible focus styles                              |
| skip-link               | 2.4.1  | Skip navigation presence and function               |
| focus-not-obscured      | 2.4.11 | Focused elements hidden by overlays                 |
| focus-after-interaction | 2.4.3  | Focus lost after clicking buttons                   |
| tabindex-abuse          | 2.4.3  | Positive tabindex values                            |
| roving-tabindex-broken  | 2.1.1  | Composite widget members unreachable via arrow keys |

See [rules reference](references/rules.md) for details on each rule.
See [fix patterns](references/fix-patterns.md) for code-level solutions.

## Exit Codes

- **0**: No error-severity violations or rule evaluation errors (warnings may exist)
- **1**: At least one error-severity accessibility violation
- **2**: Invalid config, runtime/reporter failure, or incomplete rule evaluation
