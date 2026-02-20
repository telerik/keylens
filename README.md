<div align="center">

# 🔍 Keylens

**See your site through the lens of keyboard users.**

Keyboard navigation testing CLI that goes beyond static analysis — it actually tabs through your page and tells you what's broken.

[![CI](https://github.com/telerik/keylens/actions/workflows/ci.yml/badge.svg)](https://github.com/telerik/keylens/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@telerik/keylens.svg)](https://www.npmjs.com/package/@telerik/keylens)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

[Getting Started](#getting-started) · [Rules](#rules) · [AI Features](#ai-features) · [MCP Server](#mcp-server) · [Configuration](#configuration) · [Contributing](CONTRIBUTING.md)

</div>

---

## Why Keylens?

Existing accessibility tools scan your HTML for potential issues. But **none of them actually use the keyboard.** They check if elements _could_ be focusable — Keylens checks if they _actually are_.

Keylens launches a real browser, presses Tab through your entire page, and reports:

- 🪤 **Keyboard traps** — elements you can't escape
- 🚫 **Unreachable elements** — interactive elements that never receive focus
- 🔀 **Focus order mismatches** — tab order that doesn't match visual layout
- 👻 **Missing focus indicators** — invisible focus states
- ⏭️ **Skip link issues** — missing or broken skip navigation
- 🤖 **AI-powered analysis** — intelligent fix suggestions and focus order validation

## Getting Started

### Quick Scan

No installation required:

```bash
npx keylens audit https://your-site.com
```

### Install Globally

```bash
npm install -g @telerik/keylens
keylens audit https://your-site.com
```

### Install in a Project

```bash
npm install --save-dev @telerik/keylens
```

```json
{
  "scripts": {
    "test:keyboard": "keylens audit https://localhost:3000"
  }
}
```

## Usage

### CLI

```bash
# Basic audit
keylens audit https://example.com

# With HTML report
keylens audit https://example.com --output cli,html

# With Markdown report
keylens audit https://example.com --output cli,markdown

# All reporters + verbose output
keylens audit https://example.com --output cli,json,html,markdown --verbose

# Custom viewport (mobile)
keylens audit https://example.com --viewport 375x667

# Wait for SPA content to load
keylens audit https://example.com --wait-for "#app-loaded" --wait 3000

# Use Firefox instead of Chromium
keylens audit https://example.com --browser firefox

# Custom tab delay (slower tabbing)
keylens audit https://example.com --tab-delay 500

# Custom navigation timeout (default: 30s)
keylens audit https://example.com --timeout 60000

# Enable AI analysis (set KEYLENS_AI_API_KEY env var first)
keylens audit https://example.com --ai

# Use a specific AI model
keylens audit https://example.com --ai --ai-model claude-sonnet-4-20250514

# Watch mode (visible browser)
keylens audit https://example.com --headed
```

### Programmatic API

```typescript
import { audit, DEFAULT_CONFIG } from "@telerik/keylens";

const report = await audit("https://example.com", {
  ...DEFAULT_CONFIG,
  reporters: ["json"],
  outputDir: "./a11y-reports",
  ai: {
    ...DEFAULT_CONFIG.ai,
    enabled: true,
  },
});

if (report.summary.totalErrors > 0) {
  console.error(`Found ${report.summary.totalErrors} keyboard a11y errors`);
  process.exit(1);
}
```

### Configuration File

Generate a config file:

```bash
keylens init
```

This creates `keylens.config.json`:

```json
{
  "urls": ["https://example.com"],
  "viewport": { "width": 1280, "height": 720 },
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
  "tabDelay": 250,
  "browser": "chromium",
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

Then run with:

```bash
keylens audit https://example.com --config keylens.config.json
```

## Rules

| Rule                      | Severity | WCAG       | Description                                      |
| ------------------------- | -------- | ---------- | ------------------------------------------------ |
| `keyboard-trap`           | Error    | 2.1.2      | Detects elements that trap keyboard focus        |
| `unreachable-elements`    | Error    | 2.1.1      | Finds interactive elements not reachable via Tab |
| `focus-order-mismatch`    | Warning  | 2.4.3      | Flags when tab order diverges from visual layout |
| `tabindex-abuse`          | Warning  | 2.4.3      | Detects positive `tabindex` values               |
| `missing-focus-indicator` | Warning  | 2.4.7      | Finds elements with suppressed focus styles      |
| `skip-link`               | Warning  | 2.4.1      | Validates skip navigation link presence          |
| `focus-not-obscured`      | Error    | 2.4.11     | Detects focused elements hidden by overlays      |
| `focus-after-interaction` | Warning  | 2.4.3/2.4.7| Focus not lost after clicking buttons            |

## AI Features

Keylens optionally integrates with LLMs to provide intelligent analysis that pure heuristics can't match. **The tool works fully without AI** — these are enhancement features.

### Enable AI

```bash
# Via environment variable
export KEYLENS_AI_API_KEY=sk-ant-...
keylens audit https://example.com --ai
```

You can also use `ANTHROPIC_API_KEY` or set `ai.apiKey` in your config file.

### What AI adds

**🔧 Fix Suggestions** — Inspects the actual HTML/CSS of failing elements and generates specific, copy-pasteable code fixes.

**🗺️ Focus Order Validation** — Evaluates whether the tab order makes semantic sense given the page layout, catching issues geometric algorithms miss.

**📝 Report Summaries** — Generates plain-English executive summaries suitable for non-technical stakeholders.

**🧩 Widget Classification** — Identifies widget patterns (combobox, accordion, tab panel) and reports the expected keyboard interactions from the WAI-ARIA APG.

**🏷️ Accessible Name Inference** — Suggests `aria-label` values for unnamed or generic interactive elements using vision analysis.

**🎯 Focus Indicator Quality Scoring** — Vision-based scoring (1-10) of focus indicator contrast and visibility on each element.

**🔗 Cross-Page Pattern Detection** — Detects inconsistent tab order, missing components, and skip link inconsistencies across multiple pages.

## MCP Server

Keylens includes an MCP server for integration with AI agents (Claude Desktop, VS Code Copilot, Cursor, etc.).

### Setup

Add to your MCP client config (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "keylens": {
      "command": "npx",
      "args": ["-y", "@telerik/keylens", "mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Or use the binary directly:

```json
{
  "mcpServers": {
    "keylens": {
      "command": "keylens-mcp"
    }
  }
}
```

### Available Tools

| Tool                           | Description                               |
| ------------------------------ | ----------------------------------------- |
| `keylens_audit`                | Single-page keyboard accessibility audit  |
| `keylens_audit_multiple`       | Multi-page audit with cross-page patterns |
| `keylens_classify_widgets`     | Identify ARIA widget patterns on a page   |
| `keylens_validate_focus_order` | Check if focus order is logical           |

All audit tools accept `options.reporters` (`["cli", "json", "html", "markdown"]`) and `options.outputDir` to generate file-based reports in addition to the JSON response. For example, passing `reporters: ["html"]` writes an interactive HTML focus-map report to disk:

```
Tool: keylens_audit
{
  "url": "https://example.com",
  "options": {
    "reporters": ["html"],
    "outputDir": "./keylens-report"
  }
}
```

## Agent Skill

Keylens ships with an agent skill for Claude Code and compatible agent platforms. The `/keylens` skill provides guided keyboard accessibility auditing workflows.

The skill files are included in the npm package under `skill/`.

## CI/CD Integration

### GitHub Actions

```yaml
- name: Keyboard Navigation Audit
  run: npx keylens audit https://localhost:3000 --output json
```

Keylens exits with code 1 when errors are found, making it easy to fail CI builds.

### With a Dev Server

```yaml
- name: Start dev server
  run: npm start &
- name: Wait for server
  run: npx wait-on http://localhost:3000
- name: Audit
  run: npx keylens audit http://localhost:3000
```

## How It Works

1. **Launch** — Starts a real browser via Playwright
2. **Discover** — Finds all interactive elements on the page
3. **Crawl** — Programmatically presses Tab, recording every focus change
4. **Analyze** — Runs rules against the focus sequence and element data
5. **Enhance** — Optionally sends data to an LLM for intelligent analysis
6. **Report** — Outputs results to terminal, JSON, Markdown, and/or interactive HTML

## Known Limitations

- **iframes** — Keylens does not cross into `<iframe>` content. Each iframe would need to be audited as a separate URL.
- **Shadow DOM** — Elements inside closed shadow roots are not discoverable. Open shadow roots are partially supported.
- **Memory with screenshots** — Enabling `--screenshots` stores base64 PNG data for every focused element. On pages with hundreds of focusable elements this can use significant memory. The JSON reporter strips screenshots to keep file sizes reasonable.
- **Dynamic content / SPAs** — Page content that loads asynchronously may not be present during the crawl. Use `--wait-for <selector>` and `--wait <ms>` to wait for SPA hydration.
- **Modal state** — The crawl captures a single point-in-time snapshot. Elements behind modals or in collapsed accordions may appear unreachable. Use `--interactions` to test post-click focus behavior.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

The best way to contribute is to **add a new rule**. Check out the [contributing guide](CONTRIBUTING.md#contributing-a-new-rule) for a step-by-step walkthrough.

## Roadmap

- [x] Screenshot-based focus indicator detection (pixel diff)
- [x] Interactive HTML report with visual focus order overlay
- [x] AI widget classification + APG keyboard pattern testing
- [x] Multi-page scanning
- [x] MCP server for AI agent integration
- [x] Agent skill for Claude Code
- [ ] Playwright test helper (`expect(page).toHaveLogicalFocusOrder()`)
- [ ] GitHub Actions integration
- [ ] Storybook addon
- [ ] VS Code extension

## License

[MIT](LICENSE)
