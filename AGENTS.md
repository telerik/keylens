# Keylens

Keyboard navigation testing CLI. Tabs through pages with a real browser, detects problems, outputs actionable reports.

> Full product vision, competitive analysis, AI feature specs, and go-to-market plan: [docs/VISION.md](docs/VISION.md)

**Core pitch:** "axe-core tells you if your HTML has accessibility problems. Keylens tells you if your keyboard actually works."

## The Gap

No existing tool programmatically tabs through a page, records the actual focus sequence, detects problems, and outputs a report. Static tools (axe-core, Pa11y, Lighthouse) check if elements _could_ be focusable but never press Tab. Microsoft Accessibility Insights has manual tab-stop numbering but isn't scriptable or CI-compatible. Browser devtools and extensions (Taba11y, Firefox tab order, Polypane) are manual and browser-only.

## Architecture

Pipeline: **Crawl** -> **Rules** -> **Reporters**

```
src/
  cli/index.ts           # Commander.js CLI (audit + init commands)
  crawler/index.ts       # Playwright tab crawling + skip link testing + element screenshots + post-click interaction testing
  rules/                 # Each rule implements the Rule interface, evaluated against CrawlResult
    keyboard-trap.ts     # WCAG 2.1.2 - focus trap detection
    unreachable-elements.ts  # WCAG 2.1.1 - interactive elements never reached
    focus-order-mismatch.ts  # WCAG 2.4.3 - tab order vs visual layout
    tabindex-abuse.ts    # WCAG 2.4.3 - positive tabindex values
    missing-focus-indicator.ts  # WCAG 2.4.7 - pixelmatch screenshot diff + CSS heuristic
    skip-link.ts         # WCAG 2.4.1 - skip link presence and functional verification
    focus-not-obscured.ts  # WCAG 2.4.11 - focused element not hidden by overlays
    focus-after-interaction.ts  # WCAG 2.4.3/2.4.7 - focus not lost after clicking buttons
  reporters/             # CLI (chalk), JSON (CI-friendly), HTML (visual focus map overlay), Markdown (LLM-friendly)
    cli-reporter.ts      # Terminal output, single + multi-page (reportCLI + reportMultiCLI)
    json-reporter.ts     # JSON for CI, single + multi-page (screenshots stripped)
    html-reporter.ts     # Interactive HTML with focus order map overlay, tabbed multi-page
    markdown-reporter.ts # Markdown for LLM piping, token-efficient text-only reports
    index.ts             # Dispatcher: runReporters (single) + runMultiReporters (multi)
  mcp/
    server.ts            # MCP server entry point (stdio transport, tool registration)
    handlers.ts          # Tool handler functions + helpers (buildConfig, compactReport)
  ai/index.ts            # Optional AI layer (Anthropic Claude). Dynamic import of SDK. Vision queries, widget classification, name inference.
  ai/schemas.ts          # Zod schemas for validating structured AI JSON responses (safeParseJSON helper)
  types/index.ts         # All core types (config, crawl results, rules, reports, AI structured outputs)
  utils/
    config.ts            # JSON config loading with deep merge over defaults
    logger.ts            # Leveled logging (debug/info/warn/error/silent)
    selectors.ts         # Browser-injected scripts for element discovery + pageRect
    screenshot-annotator.ts  # Annotate page screenshots with numbered focus order markers (pngjs)
  errors.ts              # Custom error hierarchy (KeylensError, CrawlError, etc.)
index.ts                 # Programmatic API: audit() + auditMultiple() -> AuditReport / MultiPageReport
skill/
  SKILL.md               # Agent skill definition (YAML frontmatter + instructions)
  references/
    rules.md             # Condensed rule reference for agents
    fix-patterns.md      # Code-level fix patterns by rule
```

## Commands

```bash
npm run build          # tsup (ESM, generates .d.ts)
npm run dev            # tsup --watch
npm test               # vitest run
npm run test:coverage  # vitest run --coverage (v8 provider)
npm run lint           # eslint src/ tests/
npm run typecheck      # tsc --noEmit
npm run keylens        # run CLI from source via tsx
```

## Stack

- **TypeScript** (strict, ES2022, ESM-only)
- **Playwright** for cross-browser automation (chromium/firefox/webkit)
- **Commander.js** for CLI, **chalk** + **ora** for terminal output
- **Vitest** v4 for testing, **tsup** for bundling
- **pixelmatch** + **pngjs** for focus indicator screenshot diffing
- **@anthropic-ai/sdk** (optional dep) for AI features
- **@modelcontextprotocol/sdk** + **zod** for MCP server

## Key Technical Decisions

- **Playwright over Puppeteer** - cross-browser, better API, active maintenance
- **Rule-based architecture** - each check is a standalone module implementing `Rule` interface
- **Screenshot diffing for focus indicators** - pixelmatch compares focused vs unfocused element screenshots pixel-by-pixel. Novel approach, no other tool does this programmatically
- **Two-phase focus indicator detection** - fast CSS heuristic first (outline: none patterns in HTML), then pixel-accurate screenshot comparison when `--screenshots` is enabled
- **Skip link functional testing** - crawler tabs through first 5 elements, identifies skip links by pattern, presses Enter, verifies focus actually moves to main content region
- **Per-element screenshots** - during tab crawl, captures focused state of current element + unfocused state of previous element, enabling before/after comparison
- **HTML focus order overlay** - `buildFocusMapHTML()` renders page screenshot as background with percentage-positioned numbered markers at each focused element, SVG dashed connecting lines between consecutive markers, violation markers colored red. Uses `pageRect` for absolute positioning within `pageDimensions`
- **Multi-page scanning** - `auditMultiple()` audits URLs sequentially, returns `MultiPageReport` with per-page results and aggregate summary. Each reporter has single + multi variants (e.g. `reportHTML` + `reportMultiHTML`)
- **Post-click interaction testing** - `--interactions` flag enables `crawlInteractions()` which clicks buttons and `role="button"` elements after the tab crawl, verifies focus isn't lost to `<body>`. Skips links (to avoid navigation) and `type="submit"` inputs
- **AI widget classification** - `classifyWidgets()` filters interactive elements to complex ARIA roles, sends to Claude to identify APG patterns (dialog, menu, tabs, accordion, combobox, disclosure, tooltip), returns confidence scores and expected keyboard behaviors
- **Vision-based AI analysis** - `queryVision()` sends annotated screenshots + text prompts to Anthropic vision API for focus order validation and accessible name inference. Screenshot annotator draws numbered markers on page screenshots using pngjs bitmap rendering
- **Structured AI outputs** - fix suggestions, focus order analysis, and name suggestions return structured JSON (e.g. `FixSuggestion`, `AIFocusOrderResult`) with fallback to plain strings for backward compatibility
- **Computed focus styles** - crawler captures `outline`, `boxShadow`, `border` CSS values while elements are focused (when `--screenshots` enabled), enriching AI fix suggestion prompts
- **HTML escaping** - all user-supplied strings (selectors, messages, URLs) are escaped in HTML output via `escapeHTML()` helper to prevent XSS
- **Tabbed multi-page HTML** - multi-page reports use CSS tabs with JS switching, each page gets its own focus map and rules section
- **AI is optional** - tool is fully useful without an API key. AI is a premium layer on top
- **Browser scripts as template strings** - selectors.ts contains JS strings evaluated via `page.evaluate()`, not typed as Node code
- **Exit code 1** on errors for CI/CD integration
- **MCP server via stdio** - `src/mcp/server.ts` uses `StdioServerTransport`, silences logger (`setLogLevel("silent")`) to prevent stdout pollution. Handler logic in `handlers.ts` is separated for testability
- **MCP sampling** - `src/mcp/sampling.ts` implements `AITransport` via MCP `sampling/createMessage`, allowing AI features without a separate API key when the client supports sampling (Copilot, Claude Desktop). Priority: direct API key > sampling > no AI
- **AITransport abstraction** - `AITransport` interface in `types/index.ts` decouples `AIAnalyzer` from specific providers. `query()` and `queryVision()` route through transport when present and no API key is set
- **MCP tools wrap full pipeline** - specialized tools (`classify_widgets`, `validate_focus_order`) run a full audit with only the relevant AI feature enabled, then extract that portion of the report. Avoids exposing internal AI methods

## Crawler Pipeline

The crawler (`src/crawler/index.ts`) runs these phases in order:

1. **Navigate** — load page, wait for selector/timeout
2. **Page screenshot** — full-page screenshot for reports
3. **Page dimensions** — capture scrollWidth/scrollHeight for overlay positioning
4. **Skip link test** — tab through first 5 elements, detect skip link patterns, press Enter, verify focus moves to `<main>`, `[role="main"]`, `#main-content`, `#content`, or `#main`. Uses `page.mouse.click(0,0)` to reset sequential focus navigation between phases
5. **Interactive element discovery** — inject `GET_INTERACTIVE_ELEMENTS_SCRIPT` to find all interactive DOM elements
6. **Tab crawl** — press Tab in a loop (up to `maxTabs`), recording each focused element with selector, role, accessible name, bounding rect, page rect (absolute coords), optional focused/unfocused screenshots, and computed focus styles (outline, boxShadow, border). Tab settle delay is configurable via `--tab-delay <ms>` (default 250ms, min 10ms)
7. **Cross-reference** — mark which interactive elements were reached via tab
8. **Interaction testing** (opt-in, `--interactions`) — click buttons and `role="button"` elements, verify focus isn't lost to `<body>`. Skips links and submit inputs. Records `InteractionResult[]` for the `focus-after-interaction` rule

### Element Screenshots (`--screenshots`)

When enabled, the crawler captures per-element screenshots during the tab crawl:

- **Focused screenshot**: captured immediately after an element receives focus
- **Unfocused screenshot**: captured from the _previous_ element (which just lost focus when Tab moved forward)
- Uses `pageRect` (absolute page coordinates with scroll offset) for clip region
- The `missing-focus-indicator` rule compares these pairs via pixelmatch to detect missing focus styles

## Conventions

- Rule files: kebab-case (`keyboard-trap.ts`), IDs match filename
- Config keys: camelCase (`keyboardTrap`, `focusOrderMismatch`)
- Types: PascalCase, all in `src/types/index.ts`
- Tests: `describe("RuleName")` with `makeFocusedElement()`/`makeCrawlResult()` factory helpers
- Path alias: `@/*` -> `./src/*` (tsconfig + vitest config)
- Pre-commit: husky + lint-staged (eslint --fix + prettier)
- Config merge order: CLI flags > config file > defaults

## AI Features (by priority)

### High-Impact (all implemented)

1. **Focus order validation** - Vision-based: annotates page screenshot with numbered markers at each focus position, sends to vision model with focus sequence metadata. Returns structured `AIFocusOrderResult` with issues and overall assessment (`good`/`acceptable`/`poor`). Falls back to text-only analysis when no screenshot available. Implemented via `validateFocusOrder()` on `AIAnalyzer`
2. **Auto-generated fix suggestions** - Returns structured `FixSuggestion` with before/after code, WCAG reference, effort estimate, and explanation. Includes computed focus styles (outline, boxShadow, border) for richer context when `--screenshots` enabled. Falls back to plain-text string. Implemented via `generateFixSuggestions()` on `AIAnalyzer`
3. **Accessible name inference** - Vision model examines unnamed/generic interactive elements in context and suggests `aria-label` values with confidence scores and reasoning. Up to 10 elements per audit. Implemented via `inferAccessibleNames()` on `AIAnalyzer`
4. **Widget classification** - Classify interactive elements by APG pattern (dialog, menu, accordion, tabs, combobox, disclosure, tooltip) with confidence scores, and report expected keyboard behaviors for each. Implemented via `classifyWidgets()` on `AIAnalyzer`

### Medium-Impact (all implemented)

5. **Focus indicator quality scoring** - Vision-based scoring of focus indicators 1-10 with contrast/visibility assessment. Sends focused/unfocused screenshot pairs to vision model. Only scores elements with confirmed focus indicators and both screenshots. Limited to 10 per audit. Implemented via `scoreFocusIndicatorQuality()` on `AIAnalyzer`
6. **Natural language report summaries** - Structured `AIReportSummary` with overview, critical issues, prioritized fixes (effort/impact), overall score (1-100), and recommendation. Falls back to plain string. Multi-page variant via `generateMultiPageSummary()`. Implemented via refactored `generateSummary()` on `AIAnalyzer`
7. **Cross-page pattern detection** - Heuristic pre-filter (`findSharedSelectors`, `findSkipLinkInconsistencies`) + AI enrichment. Detects inconsistent tab order, missing components, inconsistent focus styles, skip link inconsistencies. Falls back to heuristic-only on AI failure. Implemented via `detectCrossPagePatterns()` on `AIAnalyzer`

### AI Config

```json
{
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "features": {
      "focusOrderValidation": true,
      "fixSuggestions": true,
      "widgetClassification": true,
      "reportSummary": true,
      "focusIndicatorQuality": false,
      "accessibleNameInference": false,
      "crossPagePatterns": true
    }
  }
}
```

OpenAI / Azure AI Foundry example:

```json
{
  "ai": {
    "enabled": true,
    "provider": "openai",
    "baseURL": "https://<resource>.services.ai.azure.com/openai/deployments/<deployment>",
    "model": "gpt-4o"
  }
}
```

API key resolution: config `apiKey` > `KEYLENS_AI_API_KEY` env > `ANTHROPIC_API_KEY` env (anthropic) / `OPENAI_API_KEY` env (openai)

## Risks

- **Dynamic content / SPAs** - mitigated by `--wait-for` selector and configurable timeouts
- **Modals/overlays** - focus changes based on interaction state, addressed by `--interactions` flag (Phase 3)
- **False positives on focus order** - "logical" order is subjective; flag as warnings, allow user-configured expected order
- **Screenshot diff reliability** - focus styles vary wildly; supplement pixel diff with computed style comparison (outline, box-shadow, border)
