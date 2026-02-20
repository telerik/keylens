# Configuration

## Config File

Generate a config file with:

```bash
keylens init
```

This creates `keylens.config.json` with all defaults. The file supports JSON Schema for IDE autocomplete — add the `$schema` property:

```json
{
  "$schema": "https://raw.githubusercontent.com/telerik/keylens/master/keylens.config.schema.json"
}
```

## Full Example

```json
{
  "urls": [],
  "viewport": { "width": 1280, "height": 720 },
  "maxTabs": 500,
  "tabTimeout": 3000,
  "waitAfterLoad": 1000,
  "tabDelay": 250,
  "browser": "chromium",
  "headed": false,
  "captureElementScreenshots": false,
  "interactions": false,
  "rules": {
    "keyboardTrap": true,
    "unreachableElements": true,
    "focusOrderMismatch": true,
    "tabindexAbuse": true,
    "missingFocusIndicator": true,
    "skipLink": true,
    "focusNotObscured": true,
    "focusAfterInteraction": true
  },
  "reporters": ["cli"],
  "outputDir": "./keylens-report",
  "ai": {
    "enabled": false,
    "provider": "anthropic",
    "features": {
      "focusOrderValidation": true,
      "fixSuggestions": true,
      "widgetClassification": false,
      "reportSummary": true,
      "focusIndicatorQuality": false,
      "accessibleNameInference": false,
      "crossPagePatterns": true
    }
  }
}
```

## Key Options

### `urls`

An array of URLs to audit. When running `keylens audit` without a URL argument, these URLs are used. If multiple URLs are specified, Keylens runs a multi-page audit and produces an aggregate report.

```json
{
  "urls": [
    "https://example.com",
    "https://example.com/about",
    "https://example.com/contact"
  ]
}
```

### `captureElementScreenshots`

When `true`, the crawler captures per-element focused and unfocused screenshots during the tab crawl. These are compared via pixelmatch to detect missing focus indicators with higher confidence. Equivalent to `--screenshots` CLI flag.

### `interactions`

When `true`, the crawler clicks buttons and `role="button"` elements after the tab crawl and checks whether focus is maintained. Links and submit inputs are skipped. Equivalent to `--interactions` CLI flag. Requires the `focusAfterInteraction` rule to be enabled (it is by default).

### `tabDelay`

Delay in milliseconds between consecutive Tab key presses during the crawl. Default is `250`. Minimum accepted value is `10`. Equivalent to `--tab-delay` CLI flag. Increase this value for pages with heavy animations or transitions; decrease it for faster audits on simple pages.

### `reporters`

Array of reporter types to use: `"cli"`, `"json"`, `"html"`, `"markdown"`. The HTML reporter includes a visual focus order map overlay when page screenshots and focus sequence data are available. For multi-page audits, the HTML report shows a tabbed interface with per-page sections. The Markdown reporter outputs to `keylens-report.md` (single-page) or `keylens-report-multi.md` (multi-page).

### `rules`

Enable or disable individual rules. All rules are enabled by default.

### `ai`

See [AI Features](/guide/ai) for full configuration details.

## Precedence

CLI flags override config file values, which override defaults:

```
defaults < keylens.config.json < CLI flags
```
