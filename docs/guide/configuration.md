# Configuration

Generate a starter file:

```bash
npx keylens init
```

Config is strict JSON. Unknown keys, invalid URLs, and out-of-range values fail before
the audit. Partial nested objects are accepted and merged with defaults.

```json
{
  "$schema": "https://raw.githubusercontent.com/telerik/keylens/master/keylens.config.schema.json",
  "urls": ["https://example.com"],
  "profile": "balanced",
  "capture": { "page": "none", "elements": false },
  "reporters": ["cli", "json"]
}
```

Precedence is:

```text
defaults < selected profile < explicit config values < CLI values
```

## Execution profiles

Profiles set only `maxTabs`, `tabTimeout`, `waitAfterLoad`, and `tabDelay`.

| Profile    | Max Tabs | Tab timeout | Load wait | Tab delay | Use                                |
| ---------- | -------: | ----------: | --------: | --------: | ---------------------------------- |
| `fast`     |      400 |      500 ms |    250 ms |     25 ms | Local smoke checks on stable pages |
| `balanced` |      500 |    3,000 ms |  1,000 ms |    250 ms | Default general and CI audit       |
| `thorough` |    1,000 |    5,000 ms |  2,000 ms |    500 ms | Slow, animated, or large pages     |

Explicit values override the profile. A profile never disables capture, interaction,
or timeout limits.

## Full configuration shape

```json
{
  "profile": "balanced",
  "urls": ["https://example.com"],
  "viewport": { "width": 1280, "height": 720 },
  "maxTabs": 500,
  "tabTimeout": 3000,
  "waitForSelector": "[data-app-ready]",
  "waitAfterLoad": 1000,
  "tabDelay": 250,
  "browser": "chromium",
  "navigationTimeout": 30000,
  "headed": false,
  "prepare": {
    "dismissOverlays": true,
    "consentPreference": "reject",
    "dismissSelectors": ["#my-banner .close"],
    "timeout": 5000,
    "cookies": [{ "name": "consent", "value": "1" }],
    "steps": [
      { "type": "click", "selector": "#tour-close", "optional": true },
      { "type": "press", "key": "Escape" },
      { "type": "wait", "ms": 300 },
      { "type": "waitFor", "selector": "[data-app-ready]" }
    ],
    "expandScrollContainers": true
  },
  "capture": {
    "page": "none",
    "elements": false,
    "limits": {
      "maxElements": 200,
      "maxDimension": 16384,
      "maxPixels": 40000000,
      "maxBytes": 52428800
    }
  },
  "interactions": {
    "enabled": false,
    "maxCases": 20,
    "timeout": 2000,
    "include": [".audit-safe"],
    "exclude": [".opens-payment"],
    "actions": ["click"],
    "isolation": "reload",
    "navigation": "block",
    "excludeDestructive": true
  },
  "multiPage": { "concurrency": 2 },
  "timeouts": {
    "total": 120000,
    "crawl": 90000,
    "rules": 10000,
    "interactions": 30000,
    "ai": 30000,
    "reporters": 15000
  },
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
  "reporters": ["cli", "json"],
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
    },
    "limits": { "batchSize": 10, "maxWidgets": 20, "maxElements": 10 }
  }
}
```

All timeout values and capture byte limits are milliseconds and bytes respectively.
Omit optional `include`, `exclude`, and timeout budgets when they are not needed.

## Cookie/consent prepare phase {#prepare}

`prepare` runs after navigation and before the tab crawl, so cookie/consent banners
don't pollute the recorded focus sequence:

| Option               | Default    | Description                                                                 |
| --------------------- | ---------- | ---------------------------------------------------------------------------- |
| `dismissOverlays`     | `true`     | Auto-dismiss known CMP banners (built-in presets) or a generic heuristic fallback |
| `consentPreference`   | `"reject"` | Preferred action when a banner offers more than one: `"reject"`, `"accept"`, or `"close"` |
| `dismissSelectors`    | —          | Extra selectors to click once, for custom banners/modals not covered by a preset |
| `timeout`             | `5000`     | Whole-phase wall-time budget in ms; a slow or stuck banner degrades to a warning, never fails the audit |
| `cookies`             | —          | Cookies applied to the browser context before navigation (`name`, `value`, optional `domain`/`path`) |
| `steps`               | —          | Generic scripted steps run after dismissal: `click` (optional selector click), `press` (key), `wait` (fixed delay), `waitFor` (selector) |
| `expandScrollContainers` | `true` | Detect and neutralize full-page "faux scroll" containers — `overflow: auto/scroll` wrappers used by parallax/smooth-scroll designs instead of the document itself — so page height, full-page screenshots, and the HTML focus map reflect the true page length |

Setting `dismissOverlays: false` (or `--keep-overlays`) restores pre-prepare-phase
behavior — useful when you specifically want to audit the banner itself.
Custom selectors and steps still run when `dismissOverlays` is `false`.

Setting `expandScrollContainers: false` (or `--no-expand-scroll-containers`) skips the
faux-scroll-container check entirely — useful if the heuristic misidentifies a
legitimate `overflow: auto` region (e.g. a code sample viewer) as the page container.

Every dismissal attempt is reported: `crawl.prepare.dismissals` (provider, action,
selector, whether the container was verified hidden) and `crawl.prepare.warnings` for
anything that didn't succeed. A detected faux-scroll container is reported via
`crawl.prepare.scrollContainerExpanded` (selector, original and expanded height). See
[CLI reference](./cli#cookieconsent-banners) for the matching `--keep-overlays` /
`--dismiss` / `--consent` / `--no-expand-scroll-containers` flags.

## Exhaustive audit within budgets

“Exhaustive” means enabling all available deterministic evidence collection while
retaining enforced safety limits; it does not mean unbounded or complete WCAG coverage.

```json
{
  "profile": "thorough",
  "capture": {
    "page": "full",
    "elements": true,
    "limits": {
      "maxElements": 400,
      "maxDimension": 16384,
      "maxPixels": 80000000,
      "maxBytes": 104857600
    }
  },
  "interactions": {
    "enabled": true,
    "maxCases": 50,
    "timeout": 3000,
    "actions": ["click", "enter", "space"],
    "isolation": "reload",
    "navigation": "block",
    "excludeDestructive": true
  },
  "timeouts": {
    "total": 300000,
    "crawl": 180000,
    "rules": 30000,
    "interactions": 90000,
    "reporters": 30000
  },
  "reporters": ["cli", "json", "html", "markdown"]
}
```

Review selectors and limits for the target environment before enabling interactions.
Use `include` to restrict activation to known-safe controls. AI remains a separate,
experimental choice and is not required for an exhaustive deterministic audit.

## Capture degradation

The capture budget is shared by the page image and focus-state images. `maxDimension`
limits each image; `maxPixels` and `maxBytes` limit cumulative decoded pixels and
encoded bytes. `maxElements` limits focus-state pairs. Exceeding a limit skips capture
rather than failing the audit. `crawl.capture` reports attempted, captured, skipped,
failed, byte, and pixel totals.

## Multi-page execution

`multiPage.concurrency` controls isolated contexts in one reused browser. The default is 2. The first page failure stops new work and rejects the multi-page operation; it does
not return a partial multi-page report.

## AI configuration

AI is disabled by default and experimental. See [AI features](./ai) for providers,
credentials, data handling, and feature-specific limits.
