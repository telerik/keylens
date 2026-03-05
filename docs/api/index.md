# Programmatic API

Keylens can be used as a library in your own scripts and test suites.

## Functions

### `audit(url, config)`

Run a keyboard navigation audit on a single URL.

```typescript
import { audit, DEFAULT_CONFIG } from "@telerik/keylens";

const report = await audit("https://example.com", {
  ...DEFAULT_CONFIG,
  reporters: ["json"],
});

console.log(`Errors: ${report.summary.totalErrors}`);
console.log(`Warnings: ${report.summary.totalWarnings}`);
```

| Parameter | Type                   | Description        |
| --------- | ---------------------- | ------------------ |
| `url`     | `string`               | The URL to audit   |
| `config`  | `KeylensConfig`        | Full configuration |
| Returns   | `Promise<AuditReport>` | The audit report   |

The audit pipeline runs in order: crawl the page, run rules against the crawl result, optionally run AI analysis, then output reports.

### `auditMultiple(urls, config)`

Run audits on multiple URLs and produce an aggregate report.

```typescript
import { auditMultiple, DEFAULT_CONFIG } from "@telerik/keylens";

const report = await auditMultiple(
  ["https://example.com", "https://example.com/about"],
  {
    ...DEFAULT_CONFIG,
    reporters: ["html"],
    outputDir: "./keylens-report",
  },
);

console.log(`Pages: ${report.summary.totalPages}`);
console.log(`Total errors: ${report.summary.totalErrors}`);
console.log(`Pages with errors: ${report.summary.pagesWithErrors}`);
```

| Parameter | Type                       | Description        |
| --------- | -------------------------- | ------------------ |
| `urls`    | `string[]`                 | URLs to audit      |
| `config`  | `KeylensConfig`            | Full configuration |
| Returns   | `Promise<MultiPageReport>` | Aggregate report   |

Each page is audited sequentially. The returned `MultiPageReport` contains individual `AuditReport` objects in the `pages` array plus an aggregate `summary`.

### `crawlOnly(url, config)`

Lightweight crawl-only path: crawl + rules, no reporters, no AI. Used internally by MCP specialized tools but available for programmatic use when you only need the raw crawl data.

```typescript
import { crawlOnly, DEFAULT_CONFIG } from "@telerik/keylens";

const crawlResult = await crawlOnly("https://example.com", DEFAULT_CONFIG);
console.log(`Found ${crawlResult.focusSequence.length} focusable elements`);
```

| Parameter | Type                   | Description      |
| --------- | ---------------------- | ---------------- |
| `url`     | `string`               | The URL to crawl |
| `config`  | `KeylensConfig`        | Configuration    |
| Returns   | `Promise<CrawlResult>` | Raw crawl data   |

### `AIAnalyzer`

Class for running AI analysis independently. Requires an API key or `AITransport`.

```typescript
import { AIAnalyzer } from "@telerik/keylens";

const ai = new AIAnalyzer({
  enabled: true,
  provider: "anthropic",
  features: { fixSuggestions: true },
});

if (ai.isAvailable()) {
  // Use AI methods directly
}
```

### `DEFAULT_CONFIG`

The default configuration object. Spread it and override only what you need:

```typescript
import { audit, DEFAULT_CONFIG } from "@telerik/keylens";

await audit("https://example.com", {
  ...DEFAULT_CONFIG,
  interactions: true,
  reporters: ["cli", "html"],
  rules: { ...DEFAULT_CONFIG.rules, tabindexAbuse: false },
});
```

## Integration with Test Frameworks

### Vitest / Jest

```typescript
import { audit, DEFAULT_CONFIG } from "@telerik/keylens";
import { describe, it, expect } from "vitest";

describe("Keyboard Accessibility", () => {
  it("should have no keyboard navigation errors", async () => {
    const report = await audit("http://localhost:3000", {
      ...DEFAULT_CONFIG,
      reporters: [], // No console output during tests
    });

    expect(report.summary.totalErrors).toBe(0);
  }, 30000);
});
```

## Types

All types are exported from the package:

```typescript
import type {
  KeylensConfig,
  RuleConfig,
  AIConfig,
  AITransport,
  ReporterType,
  Severity,
  Rule,
  BoundingRect,
  AuditReport,
  MultiPageReport,
  CrawlResult,
  FocusedElement,
  InteractiveElement,
  SkipLinkResult,
  RuleResult,
  RuleViolation,
  InteractionResult,
  WidgetClassification,
  APGPattern,
  AIFocusOrderResult,
  FocusOrderIssue,
  FixSuggestion,
  AccessibleNameSuggestion,
  FocusIndicatorScore,
  AIReportSummary,
  CrossPagePattern,
  CrossPagePatternType,
} from "@telerik/keylens";
```

---

### Configuration

#### `KeylensConfig`

Top-level configuration passed to `audit()` and `auditMultiple()`.

| Field                       | Type                                  | Description                                   |
| --------------------------- | ------------------------------------- | --------------------------------------------- |
| `urls`                      | `string[]`                            | URLs to audit (used by CLI when no arg given) |
| `viewport`                  | `{ width: number; height: number }`   | Browser viewport dimensions                   |
| `maxTabs`                   | `number`                              | Max Tab presses before stopping               |
| `tabTimeout`                | `number`                              | Timeout per Tab press (ms)                    |
| `tabDelay`                  | `number`                              | Delay between tab presses in ms (min 10)      |
| `waitForSelector`           | `string?`                             | Wait for this CSS selector before auditing    |
| `waitAfterLoad`             | `number`                              | Wait after page load (ms)                     |
| `rules`                     | `RuleConfig`                          | Enable/disable individual rules               |
| `reporters`                 | `ReporterType[]`                      | Output formats                                |
| `outputDir`                 | `string`                              | Report output directory                       |
| `browser`                   | `"chromium" \| "firefox" \| "webkit"` | Browser engine                                |
| `ai`                        | `AIConfig`                            | AI analysis settings                          |
| `headed`                    | `boolean`                             | Run with visible browser                      |
| `captureElementScreenshots` | `boolean`                             | Capture per-element screenshots               |
| `interactions`              | `boolean`                             | Enable post-click interaction testing         |

#### `RuleConfig`

Boolean toggles for each rule. All default to `true`.

| Field                   | Rule                    |
| ----------------------- | ----------------------- |
| `keyboardTrap`          | Keyboard Trap           |
| `unreachableElements`   | Unreachable Elements    |
| `focusOrderMismatch`    | Focus Order Mismatch    |
| `tabindexAbuse`         | Tabindex Abuse          |
| `missingFocusIndicator` | Missing Focus Indicator |
| `skipLink`              | Skip Link               |
| `focusNotObscured`      | Focus Not Obscured      |
| `focusAfterInteraction` | Focus After Interaction |

#### `AIConfig`

| Field       | Type                      | Description                                                                               |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `enabled`   | `boolean`                 | Enable AI analysis                                                                        |
| `provider`  | `"anthropic" \| "openai"` | AI provider                                                                               |
| `apiKey`    | `string?`                 | API key (or use `KEYLENS_AI_API_KEY` env var)                                             |
| `model`     | `string?`                 | Model override                                                                            |
| `transport` | `AITransport?`            | Custom AI transport (e.g. MCP sampling). Used when no `apiKey` is set. See `AITransport`. |
| `features`  | `object`                  | Feature toggles (see below)                                                               |

Feature toggles: `focusOrderValidation`, `fixSuggestions`, `widgetClassification`, `reportSummary`, `focusIndicatorQuality`, `accessibleNameInference`, `crossPagePatterns` — all booleans.

#### `AITransport`

Provider-agnostic interface for AI queries. Used by MCP sampling to delegate AI calls to the client's model without a separate API key.

```typescript
interface AITransport {
  query(prompt: string): Promise<string>;
  queryVision(
    prompt: string,
    images: Array<{ base64: string; mediaType: string }>,
  ): Promise<string>;
}
```

#### `ReporterType`

`"cli" | "json" | "html" | "markdown"`

---

### Reports

#### `AuditReport`

Returned by `audit()`. Contains everything about a single-page audit.

| Field                       | Type                            | Description                                      |
| --------------------------- | ------------------------------- | ------------------------------------------------ |
| `version`                   | `string`                        | Keylens version                                  |
| `timestamp`                 | `string`                        | ISO 8601 timestamp                               |
| `url`                       | `string`                        | Audited URL                                      |
| `config`                    | `Partial<KeylensConfig>`        | Configuration used                               |
| `crawl`                     | `object`                        | Crawl summary (see below)                        |
| `rules`                     | `RuleResult[]`                  | Per-rule results                                 |
| `summary`                   | `object`                        | Aggregate counts (see below)                     |
| `aiSummary`                 | `string \| AIReportSummary?`    | AI-generated report summary (structured or text) |
| `aiFocusOrderAnalysis`      | `string \| AIFocusOrderResult?` | AI focus order analysis (structured)             |
| `widgetClassifications`     | `WidgetClassification[]?`       | AI widget classifications                        |
| `accessibleNameSuggestions` | `AccessibleNameSuggestion[]?`   | AI accessible name suggestions                   |
| `focusIndicatorScores`      | `FocusIndicatorScore[]?`        | AI focus indicator quality scores                |
| `pageScreenshot`            | `string?`                       | Full-page screenshot (base64 PNG)                |
| `focusSequence`             | `FocusedElement[]?`             | Ordered focus sequence                           |
| `pageDimensions`            | `{ width, height }?`            | Page dimensions for overlay rendering            |

**`crawl` object:**

| Field                      | Type      | Description                        |
| -------------------------- | --------- | ---------------------------------- |
| `totalFocusableElements`   | `number`  | Elements in the tab sequence       |
| `totalInteractiveElements` | `number`  | Interactive elements found on page |
| `unreachedElements`        | `number`  | Interactive elements not reached   |
| `cycleCompleted`           | `boolean` | Whether focus returned to start    |
| `duration`                 | `number`  | Crawl time in ms                   |

**`summary` object:**

| Field           | Type     | Description                               |
| --------------- | -------- | ----------------------------------------- |
| `totalErrors`   | `number` | Error-severity violations                 |
| `totalWarnings` | `number` | Warning-severity violations               |
| `totalInfo`     | `number` | Info-severity violations                  |
| `passed`        | `number` | Rules that passed                         |
| `failed`        | `number` | Rules that failed                         |
| `score`         | `number` | Deterministic accessibility score (0–100) |

#### `MultiPageReport`

Returned by `auditMultiple()`.

| Field               | Type                         | Description                                |
| ------------------- | ---------------------------- | ------------------------------------------ |
| `version`           | `string`                     | Keylens version                            |
| `timestamp`         | `string`                     | ISO 8601 timestamp                         |
| `urls`              | `string[]`                   | All audited URLs                           |
| `pages`             | `AuditReport[]`              | Individual page reports                    |
| `summary`           | `object`                     | Aggregate summary (see below)              |
| `aiSummary`         | `string \| AIReportSummary?` | AI cross-page summary (structured or text) |
| `crossPagePatterns` | `CrossPagePattern[]?`        | AI-detected cross-page inconsistencies     |

**`summary` object:**

| Field             | Type     | Description                           |
| ----------------- | -------- | ------------------------------------- |
| `totalPages`      | `number` | Number of pages audited               |
| `totalErrors`     | `number` | Errors across all pages               |
| `totalWarnings`   | `number` | Warnings across all pages             |
| `totalInfo`       | `number` | Info findings across all pages        |
| `pagesWithErrors` | `number` | Pages with at least one error         |
| `score`           | `number` | Aggregate accessibility score (0–100) |

---

### Crawl Data

#### `CrawlResult`

Raw data from the Playwright tab crawl. Passed to rules for evaluation.

| Field                 | Type                   | Description                                       |
| --------------------- | ---------------------- | ------------------------------------------------- |
| `url`                 | `string`               | Crawled URL                                       |
| `focusSequence`       | `FocusedElement[]`     | Ordered list of focused elements                  |
| `interactiveElements` | `InteractiveElement[]` | All interactive elements on page                  |
| `cycleCompleted`      | `boolean`              | Focus returned to start                           |
| `pageScreenshot`      | `string`               | Full-page screenshot (base64 PNG)                 |
| `crawlDuration`       | `number`               | Crawl time in ms                                  |
| `pageDimensions`      | `{ width, height }?`   | Page scroll dimensions                            |
| `skipLinkResult`      | `SkipLinkResult?`      | Skip link test outcome                            |
| `interactionResults`  | `InteractionResult[]?` | Post-click interaction results (`--interactions`) |

#### `FocusedElement`

An element in the tab sequence, captured during the crawl.

| Field                 | Type                      | Description                                                               |
| --------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `tabIndex`            | `number`                  | Position in tab sequence (1-indexed)                                      |
| `selector`            | `string`                  | CSS selector path                                                         |
| `tagName`             | `string`                  | HTML tag name                                                             |
| `role`                | `string`                  | Computed ARIA role                                                        |
| `accessibleName`      | `string`                  | Computed accessible name                                                  |
| `boundingRect`        | `BoundingRect`            | Viewport-relative bounding box                                            |
| `tabindexAttr`        | `number \| null`          | The `tabindex` attribute value                                            |
| `hasFocusIndicator`   | `boolean \| null`         | Whether a visible focus style was detected                                |
| `isObscured`          | `boolean?`                | Whether the element is hidden by overlays                                 |
| `focusedScreenshot`   | `string?`                 | Base64 PNG of focused state (`--screenshots`)                             |
| `unfocusedScreenshot` | `string?`                 | Base64 PNG of unfocused state                                             |
| `pageRect`            | `BoundingRect?`           | Absolute page coordinates (with scroll)                                   |
| `computedFocusStyles` | `object?`                 | `{ outline, boxShadow, border }` captured while focused (`--screenshots`) |
| `ariaAttributes`      | `Record<string, string>?` | All aria-\* attributes on this element                                    |
| `parentContext`       | `string?`                 | Nearest landmark ancestor                                                 |
| `outerHTML`           | `string`                  | Truncated outer HTML                                                      |

#### `InteractiveElement`

An interactive DOM element discovered on the page.

| Field            | Type             | Description                              |
| ---------------- | ---------------- | ---------------------------------------- |
| `selector`       | `string`         | CSS selector path                        |
| `tagName`        | `string`         | HTML tag name                            |
| `role`           | `string`         | Computed ARIA role                       |
| `accessibleName` | `string`         | Computed accessible name                 |
| `boundingRect`   | `BoundingRect`   | Viewport-relative bounding box           |
| `reached`        | `boolean`        | Whether this element was reached via Tab |
| `tabindexAttr`   | `number \| null` | The `tabindex` attribute value           |
| `outerHTML`      | `string`         | Truncated outer HTML                     |

#### `SkipLinkResult`

Outcome of the skip link functional test.

| Field           | Type      | Description                                         |
| --------------- | --------- | --------------------------------------------------- |
| `found`         | `boolean` | Whether a skip link was detected                    |
| `element`       | `object?` | The skip link (selector, accessibleName, outerHTML) |
| `functionWorks` | `boolean` | Whether activating it moved focus to main content   |
| `focusTarget`   | `string?` | Where focus moved after activation                  |

---

### Rules

#### `RuleResult`

The outcome of running a single rule.

| Field             | Type              | Description               |
| ----------------- | ----------------- | ------------------------- |
| `ruleId`          | `string`          | Rule identifier           |
| `ruleName`        | `string?`         | Human-readable rule name  |
| `ruleDescription` | `string?`         | Rule description          |
| `passed`          | `boolean`         | Whether the rule passed   |
| `violations`      | `RuleViolation[]` | Violations found          |
| `wcag`            | `string[]?`       | WCAG success criteria     |
| `duration`        | `number`          | Rule execution time in ms |

#### `RuleViolation`

A single violation found by a rule.

| Field           | Type                                           | Description                         |
| --------------- | ---------------------------------------------- | ----------------------------------- |
| `ruleId`        | `string`                                       | Rule identifier                     |
| `ruleName`      | `string`                                       | Human-readable rule name            |
| `severity`      | `Severity`                                     | `"error"`, `"warning"`, or `"info"` |
| `message`       | `string`                                       | Description of the issue            |
| `elements`      | `Array<{ selector, outerHTML, tabPosition? }>` | Affected elements                   |
| `wcag`          | `string[]?`                                    | WCAG success criteria references    |
| `fixSuggestion` | `string \| FixSuggestion?`                     | AI-generated fix (when AI enabled)  |
| `impact`        | `string`                                       | Impact description                  |

#### `Severity`

`"error" | "warning" | "info"`

#### `Rule`

Interface for implementing custom rules.

```typescript
interface Rule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  wcag: string[];
  evaluate(crawlResult: CrawlResult): Promise<RuleResult>;
}
```

---

### Interaction & AI

#### `InteractionResult`

Captures the outcome of clicking a button during `--interactions` testing.

| Field             | Type                            | Description                                               |
| ----------------- | ------------------------------- | --------------------------------------------------------- |
| `element`         | `object`                        | Clicked element (selector, tagName, role, accessibleName) |
| `action`          | `"click" \| "enter" \| "space"` | Interaction type                                          |
| `focusAfter`      | `object \| null`                | Element with focus after click (`null` = lost)            |
| `focusReasonable` | `boolean`                       | Whether focus remained on a sensible target               |
| `issue`           | `string?`                       | Description of the problem                                |

#### `WidgetClassification`

AI-generated classification of a complex interactive widget.

| Field              | Type                               | Description                                                             |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------- |
| `element`          | `object`                           | Classified element (selector, tagName, role, accessibleName, outerHTML) |
| `pattern`          | `APGPattern`                       | Identified WAI-ARIA APG pattern                                         |
| `confidence`       | `number`                           | Confidence score (0–1, filtered >= 0.5)                                 |
| `expectedKeyboard` | `Array<{ key, expectedBehavior }>` | Expected keyboard interactions                                          |

#### `APGPattern`

`"dialog" | "menu" | "accordion" | "tabs" | "combobox" | "disclosure" | "tooltip" | "unknown"`

#### `AIFocusOrderResult`

Structured result from vision-based focus order validation.

| Field               | Type                | Description                        |
| ------------------- | ------------------- | ---------------------------------- |
| `summary`           | `string`            | Overall assessment text            |
| `issues`            | `FocusOrderIssue[]` | Specific issues found              |
| `overallAssessment` | `string`            | `"good"`, `"acceptable"`, `"poor"` |

#### `FocusOrderIssue`

A single issue found during focus order validation.

| Field          | Type     | Description                          |
| -------------- | -------- | ------------------------------------ |
| `elementIndex` | `number` | Position in focus sequence (1-based) |
| `description`  | `string` | What's wrong                         |
| `severity`     | `string` | `"error"`, `"warning"`, or `"info"`  |
| `suggestion`   | `string` | How to fix                           |

#### `FixSuggestion`

Structured AI-generated fix suggestion.

| Field             | Type      | Description                      |
| ----------------- | --------- | -------------------------------- |
| `summary`         | `string`  | Brief 1-sentence fix description |
| `codeBefore`      | `string?` | Original code snippet            |
| `codeAfter`       | `string?` | Fixed code snippet               |
| `wcagRef`         | `string`  | WCAG success criteria reference  |
| `estimatedEffort` | `string`  | `"low"`, `"medium"`, or `"high"` |
| `explanation`     | `string`  | Why this fix works               |

#### `AccessibleNameSuggestion`

AI-suggested accessible name for an unnamed element.

| Field            | Type      | Description                                      |
| ---------------- | --------- | ------------------------------------------------ |
| `element`        | `object`  | The element (selector, tagName, role, outerHTML) |
| `suggestedLabel` | `string`  | Suggested `aria-label` value                     |
| `suggestedRole`  | `string?` | Corrected role (if needed)                       |
| `confidence`     | `number`  | Confidence score (0–1)                           |
| `reasoning`      | `string`  | Why this label is appropriate                    |

#### `FocusIndicatorScore`

AI-generated quality score for a focus indicator.

| Field            | Type      | Description                                              |
| ---------------- | --------- | -------------------------------------------------------- |
| `element`        | `object`  | Scored element (selector, tagName, role, accessibleName) |
| `score`          | `number`  | Quality score from 1 (worst) to 10 (best)                |
| `contrast`       | `string`  | `"sufficient"`, `"low"`, or `"very-low"`                 |
| `visibility`     | `string`  | `"clear"`, `"subtle"`, or `"nearly-invisible"`           |
| `recommendation` | `string?` | Improvement suggestion (when score <= 7)                 |

#### `AIReportSummary`

Structured AI-generated report summary.

| Field              | Type                             | Description                                             |
| ------------------ | -------------------------------- | ------------------------------------------------------- |
| `overview`         | `string`                         | 2-3 sentence overall assessment                         |
| `criticalIssues`   | `string[]`                       | Most critical issues found                              |
| `prioritizedFixes` | `Array<{ fix, effort, impact }>` | Ordered fixes with effort/impact                        |
| `aiSeverityRating` | `number`                         | AI usability severity rating (1-100, non-deterministic) |
| `recommendation`   | `string`                         | One-sentence next step recommendation                   |

#### `CrossPagePattern`

An inconsistency detected across multiple pages.

| Field           | Type                   | Description                         |
| --------------- | ---------------------- | ----------------------------------- |
| `type`          | `CrossPagePatternType` | Pattern type (see below)            |
| `description`   | `string`               | Human-readable description          |
| `affectedPages` | `string[]`             | URLs of affected pages              |
| `severity`      | `Severity`             | `"error"`, `"warning"`, or `"info"` |
| `suggestion`    | `string`               | AI-generated fix suggestion         |

#### `CrossPagePatternType`

`"inconsistent-order" | "missing-component" | "inconsistent-focus-style" | "inconsistent-skip-link"`

---

### Errors

All error classes extend `KeylensError`, which extends `Error`. They are exported from the package for `instanceof` checks.

```typescript
import {
  KeylensError,
  CrawlError,
  ConfigError,
  NavigationError,
} from "@telerik/keylens";

try {
  await audit(url, config);
} catch (err) {
  if (err instanceof CrawlError) {
    console.error(`Crawl failed for ${err.url}: ${err.message}`);
  } else if (err instanceof ConfigError) {
    console.error(`Bad config: ${err.message}`);
  } else if (err instanceof NavigationError) {
    console.error(`Could not navigate to ${err.url}: ${err.message}`);
  }
}
```

| Class             | Code                 | Extra Properties |
| ----------------- | -------------------- | ---------------- |
| `KeylensError`    | (user-specified)     | `code: string`   |
| `CrawlError`      | `"CRAWL_ERROR"`      | `url: string`    |
| `ConfigError`     | `"CONFIG_ERROR"`     | —                |
| `NavigationError` | `"NAVIGATION_ERROR"` | `url: string`    |
