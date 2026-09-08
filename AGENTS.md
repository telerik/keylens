# Keylens

Keyboard navigation testing CLI. Tabs through pages with a real browser, detects problems, outputs actionable reports.

> Product vision, competitive analysis, and roadmap: [docs/VISION.md](docs/VISION.md)

**Core pitch:** "axe-core tells you if your HTML has accessibility problems. Keylens tells you if your keyboard actually works."

## The Gap

No existing tool programmatically tabs through a page, records the actual focus sequence, detects problems, and outputs a report. Static tools (axe-core, Pa11y, Lighthouse) check if elements _could_ be focusable but never press Tab. Microsoft Accessibility Insights has manual tab-stop numbering but isn't scriptable or CI-compatible. Browser devtools and extensions (Taba11y, Firefox tab order, Polypane) are manual and browser-only.

## Architecture

Pipeline: **Crawl** -> **Rules** -> **Reporters**, wrapped by abortable/timeout-bounded
execution scopes (`src/utils/execution.ts`).

```
src/
  cli/index.ts           # Commander.js CLI (audit, init, mcp commands)
  crawler/
    index.ts             # Playwright tab crawling, screenshots, interaction testing, roving-tabindex verification
    prepare.ts           # Cookie/consent banner dismissal + faux-scroll-container expansion, run before the crawl
  rules/                 # Each rule implements the Rule interface, evaluated against CrawlResult
    keyboard-trap.ts     # WCAG 2.1.2 - focus trap detection
    unreachable-elements.ts  # WCAG 2.1.1 - interactive elements never reached
    focus-order-mismatch.ts  # WCAG 2.4.3 - tab order vs DOM order
    tabindex-abuse.ts    # WCAG 2.4.3 - positive tabindex values
    missing-focus-indicator.ts  # WCAG 2.4.7 - computed-style diff (focused vs unfocused) + pixel-diff confirmation
    skip-link.ts         # WCAG 2.4.1 - skip link presence and functional verification
    focus-not-obscured.ts  # WCAG 2.4.11 - focused element not hidden by overlays
    focus-after-interaction.ts  # WCAG 2.4.3/2.4.7 - focus not lost after clicking buttons (opt-in --interactions)
    roving-tabindex-broken.ts  # WCAG 2.1.1 - composite widget members unreachable via arrow keys despite roving-tabindex markup
  reporters/             # CLI (chalk), JSON (CI-friendly), HTML (visual focus map overlay), Markdown (LLM-friendly)
    cli-reporter.ts      # Terminal output (reportCLI)
    json-reporter.ts     # JSON for CI (assets stripped by default)
    html-reporter.ts     # Interactive HTML with focus order map overlay
    markdown-reporter.ts # Markdown for LLM piping, token-efficient text-only reports
    index.ts             # Dispatcher: runReporters (also re-exports renderHTML/renderMarkdown/serializeJSON)
  mcp/
    server.ts            # MCP server entry point (stdio transport, tool registration)
    handlers.ts          # Tool handler functions + helpers (buildConfig, compactReport)
  telemetry/              # Anonymous, aggregate usage telemetry (see telemetry/README.md; no barrel index.ts, imported directly like utils/)
    constants.ts         # Shared Source enum + the 2 public opt-out env vars
    notice.ts            # One-time telemetry notice, persisted per-machine at ~/.keylens/telemetry-notice-version
    event.ts             # Allow-list building the flat JSON payload from an AuditReport/error - the only place PII could leak, so the only place it's prevented
    call-home-client.ts   # Plain-fetch OAuth2 client-credentials exchange + event upload
    context.ts            # recordAuditSuccess()/recordAuditFailure()/toCallHomeSource() - resolve machine id, show notice, never throw
  guidance.ts             # Static rule remediation catalog (WCAG refs, guidance, code example, configKey) - no browser dependency
  types/index.ts          # All core types (config, crawl results, rules, reports, events, errors)
  errors.ts               # Custom error hierarchy (KeylensError, CrawlError, ConfigError, NavigationError, AuditAbortedError, AuditTimeoutError, ReporterError)
  utils/
    config.ts            # Zod-validated config schema, defaults, execution profiles, deep merge over defaults
    execution.ts          # createExecutionScope/throwIfAborted - AbortSignal + timeout composition per phase
    logger.ts             # Leveled logging (debug/info/warn/error/silent)
    selectors.ts          # Browser-injected scripts for element discovery + pageRect
    overlay-presets.ts     # Built-in cookie/consent-banner (CMP) selector presets used by crawler/prepare.ts
    screenshot-annotator.ts  # Annotate page screenshots with numbered focus order markers (pngjs)
    aria-orientation.ts  # Per-role arrow-key direction (Left/Right vs Up/Down) for verifying roving-tabindex composite widgets
    roving-tabindex.ts    # getUnreachedInteractiveElements - roving-tabindex/composite-container reachability logic shared by crawler + rule
    focus-style-diff.ts   # hasVisibleFocusChange/computed-style diff logic shared by the crawler (pixel-diff gating) and the rule
    pixel-diff.ts          # hasVisiblePixelDiff (pixelmatch) - Stage-2 confirmation for missing-focus-indicator
    assets.ts              # projectAuditReport/cloneAuditReport - asset projection modes (inline/reference/omit)
    report-writer.ts        # Shared mkdir+writeFile+log helper for the JSON/HTML/Markdown reporters
    score.ts               # computeScore - deterministic weighted 0-100 score from rule results
    constants.ts
index.ts                 # Programmatic API: audit(), renderAuditReport(), crawlOnly()
skill/
  SKILL.md               # Agent skill definition (YAML frontmatter + instructions)
  references/
    rules.md             # Condensed rule reference for agents
    fix-patterns.md      # Code-level fix patterns by rule
```

## Commands

```bash
npm run build             # tsup (ESM, generates .d.ts)
npm run dev               # tsup --watch
npm test                  # vitest run (tests/unit/**)
npm run test:coverage     # vitest run --coverage (v8 provider; thresholds 80/65/80/80)
npm run test:integration  # vitest run --config vitest.integration.config.ts (tests/integration/**, real browser)
npm run lint              # eslint src/ tests/ benchmarks/
npm run lint:fix          # eslint --fix
npm run format            # prettier --write .
npm run format:check      # prettier --check .
npm run typecheck         # tsc --noEmit
npm run benchmark         # tsx benchmarks/run.ts
npm run benchmark:ci      # enforced budgets, writes benchmark-results.json
npm run package:verify    # build + verify published package contents (scripts/verify-package.mjs)
npm run validate          # format:check + lint + typecheck + benchmark:typecheck + build + docs:build + test:coverage (runs in the husky pre-push hook)
npm run keylens           # run CLI from source via tsx
npm run docs:dev          # vitepress dev docs
npm run docs:build        # vitepress build docs
```

## Stack

- **TypeScript** (strict, ES2022, ESM-only)
- **Playwright** for cross-browser automation (chromium/firefox/webkit)
- **Commander.js** for CLI, **chalk** + **ora** for terminal output
- **Vitest** v4 for testing, **tsup** for bundling
- **pixelmatch** + **pngjs** for focus indicator screenshot diffing
- **zod** for config schema validation and MCP tool input schemas
- **@modelcontextprotocol/sdk** for the MCP server
- **@telerik/machine-id** for the one-way hashed machine identifier used in telemetry (see "Anonymous telemetry" below)
- **VitePress** for the docs site (`docs/`)

## Key Technical Decisions

- **Playwright over Puppeteer** - cross-browser, better API, active maintenance
- **Rule-based architecture** - each check is a standalone module implementing `Rule` interface
- **Execution profiles** (`fast`/`balanced`/`thorough`) - set only `maxTabs`, `tabTimeout`, `waitAfterLoad`, and `tabDelay` (`EXECUTION_PROFILES` in `src/utils/config.ts`). Precedence: defaults < profile < explicit config < CLI flags. A profile never disables capture, interaction, or timeout budgets
- **Abortable, timeout-bounded phases** - `createExecutionScope()` (`src/utils/execution.ts`) composes a parent `AbortSignal` with a per-phase timeout into a child signal, used for the total budget and each of setup/crawl/rules/interactions/reporters. Throws typed `AuditAbortedError`/`AuditTimeoutError` (`src/errors.ts`) instead of generic errors, so callers can distinguish cancellation from a timeout from a real failure
- **Structured progress events** - `AuditEvent` (`types/index.ts`) covers phase-started/completed, crawl-progress, interaction-progress/completed, overlay-dismissed, rule-started, and asset-captured. Passed via `onEvent` in `AuditOptions`; the CLI's ora spinner and `updateProgress()` (`src/cli/index.ts`) are the primary consumer
- **Bounded capture budgets** - `CaptureConfig`/`CaptureLimits` (`maxDimension`, `maxPixels`, `maxBytes`) gate every screenshot via a `CaptureBudget` (crawler); skipped/failed captures are counted in `crawl.capture` rather than silently dropped or crashing the audit
- **Cookie/consent + faux-scroll "prepare" phase** - `src/crawler/prepare.ts` runs before the tab crawl: dismisses cookie/consent banners (built-in `OVERLAY_PRESETS` for major CMPs in `src/utils/overlay-presets.ts`, plus a generic heuristic fallback), applies configured cookies/steps, and neutralizes full-page "faux scroll" containers (parallax/smooth-scroll sites where an inner `overflow:auto` wrapper does all the scrolling instead of `<html>`/`<body>`) so page dimensions and full-page screenshots reflect the true page length. On by default; disable overlay dismissal with `--keep-overlays` / `prepare.dismissOverlays: false`, or scroll-container expansion with `--no-expand-scroll-containers` / `prepare.expandScrollContainers: false`. Every action (or failure) is reported via `crawl.prepare`, never silent
- **Computed-style diffing for focus indicators** - crawler diffs a computed-style snapshot (outline, box-shadow, border, background, color, `::before`/`::after`, up to 4 ancestor levels for `:focus-within`, and up to 20 descendants for indicators painted on an inner child e.g. a switch's track) taken while focused vs. once focus moves away. Runs by default (no flag needed) since the crawler already focuses every element for real; catches JS/attribute-driven indicators and container-level highlighting that a CSS/HTML text scan would miss. Shared logic lives in `src/utils/focus-style-diff.ts` (used by both the crawler's pixel-diff gating and the rule)
- **Pixel-diff confirmation for missing-focus-indicator** - always runs (no flag), after all other crawl phases: for any element whose computed-style diff found no change, the crawler re-focuses it by selector and pixelmatch-diffs (`src/utils/pixel-diff.ts`) a padded screenshot of its focused vs. blurred state (`confirmMissingFocusIndicators` in `src/crawler/index.ts`, capped to 30 elements). Catches indicators computed-style diffing structurally can't see (e.g. a focus ring drawn inside a `<canvas>` bitmap by page JS). Sets `FocusedElement.focusIndicatorPixelConfirmed`, which the rule treats as passing even with no style diff
- **No general per-element `--screenshots` flag** - page-level screenshots (`capture.page`: `none`/`viewport`/`full`) and the always-on focus-style-diff/pixel-diff confirmation pair are the only screenshot mechanisms
- **Skip link functional testing** - crawler tabs through first 5 elements, identifies skip links by pattern, presses Enter, verifies focus actually moves to main content region, then reloads the page before the main tab crawl (activating the skip link can leave custom elements in a mutated state)
- **HTML focus order overlay** - `buildFocusMapHTML()` renders page screenshot as background with percentage-positioned numbered markers at each focused element, SVG dashed connecting lines between consecutive markers, violation markers colored red. Uses `pageRect` for absolute positioning within `pageDimensions`
- **Post-click interaction testing** - opt-in (`--interactions` / `interactions.enabled: true`), governed by an `InteractionConfig` policy (maxCases, per-case timeout, actions, reload isolation, navigation blocking, destructive-control exclusion), not just a boolean. `crawlInteractions()` clicks buttons and `role="button"` elements after the tab crawl and records passed/failed/skipped/error outcomes in `InteractionResult[]`
- **HTML escaping** - all user-supplied strings (selectors, messages, URLs) are escaped in HTML output via `escapeHTML()` helper to prevent XSS
- **Browser scripts as template strings** - selectors.ts contains JS strings evaluated via `page.evaluate()`, not typed as Node code
- **Three-way exit codes** - `0` no error-severity violations, `1` at least one error-severity violation, `2` the audit was incomplete (config/navigation/timeout/reporter/rule-evaluator failure). A rule evaluator error (`status: "error"`) is distinct from a rule failing its check; it marks `summary.scoreComplete: false` and takes precedence over `1`
- **Deterministic weighted score** - `computeScore()` (`src/utils/score.ts`) sums per-rule weights (`RULE_WEIGHTS`, dynamically summed to `TOTAL_WEIGHT`) for passed rules and partial credit for failed ones; evaluator-errored rules earn no weight and make the score incomplete. Adding/removing a rule shifts every hardcoded-percentage test assertion - see repo memory notes
- **Asset projection modes** - `projectAuditReport()`/`cloneAuditReport()` (`src/utils/assets.ts`) let programmatic consumers choose `inline` (embed bytes), `reference` (keep asset IDs, drop bytes), or omit assets entirely; the JSON reporter omits binary assets by default
- **Browser-safe `@telerik/keylens/guidance` subpath** - `src/guidance.ts` is a static, framework-agnostic catalog (`RULE_CATALOG`/`getRuleRemediation`/`getWcagReference`) of WCAG references, human guidance, and code examples per rule/config key. It never imports Playwright, so it can be bundled for browser/edge consumers without pulling in the crawler
- **MCP server via stdio** - `src/mcp/server.ts` uses `StdioServerTransport`, silences logger (`setLogLevel("silent")`) to prevent stdout pollution. Handler logic in `handlers.ts` is separated for testability. Only two tools are registered: `keylens_audit` (single-page audit, compact report) and `keylens_get_rule_guidance` (static lookup over `guidance.ts`, no browser involved). MCP does not expose the full config surface (capture limits, phase timeouts, interaction policy, page capture mode); use the CLI/library for those
- **Roving-tabindex arrow-key verification** - `verifyRovingTabindexGroups()` runs as the LAST crawl phase (after tab crawl and interactions) since arrow-key presses can visibly mutate page state (e.g. switching the active tab panel). Simulates real key presses per composite widget to confirm every `tabindex="-1"` member is actually reachable, rather than trusting the markup pattern alone. Reached members' live `pageRect`s feed dashed satellite markers on the HTML focus map (they never appear in the Tab-order `focusSequence`)
- **Anonymous telemetry** - `audit()` in `src/index.ts` is the single instrumentation chokepoint for all three surfaces (CLI/MCP/library); callers only tag `AuditOptions.telemetrySurface`. `src/telemetry/event.ts` is a fixed allow-list (never a spread) building one flat JSON payload per run — version, surface, result (success/partial/failure/aborted/timeout), a one-way hashed machine id (`@telerik/machine-id`, used only to deduplicate installs), categorical config knobs, and per-rule status/violation counts; never URLs, HTML, selectors, accessible names, screenshots, reports, or IPs. The API key is injected at publish time via tsup `define` (mirroring `__VERSION__`) and is never present in an unconfigured local build — a local `npm run build`/`npm test` never touches the network, but official published builds have telemetry enabled by default (users are notified and can opt out). Once a key is configured, the one-time notice (stderr only, never stdout) is shown before the first event, then persisted at `~/.keylens/telemetry-notice-version`. Opt out with `KEYLENS_TELEMETRY_OFF=1`, the shared `TELERIK_TELEMETRY_OFF=1`, or `{ telemetry: false }` for programmatic callers. See `src/telemetry/README.md`

## Crawler Pipeline

The crawler (`src/crawler/index.ts`) runs these phases in order:

1. **Navigate** — load page (`domcontentloaded`), optionally wait for `waitForSelector`, then a fixed `waitAfterLoad` delay
2. **Prepare** (`src/crawler/prepare.ts`, always runs) — apply configured cookies, dismiss cookie/consent banners (built-in CMP presets + generic heuristic, preferring `consentPreference`), run configured `prepare.steps`, and neutralize full-page "faux scroll" containers. Bounded by `prepare.timeout` (default 5s); degrades to a warning rather than blocking the audit
3. **Page dimensions** — capture scrollWidth/scrollHeight for overlay positioning (post-prepare, so expanded faux-scroll containers are measured correctly)
4. **Page screenshot** — bounded by `capture.page` mode (`none`/`viewport`/`full`) and `CaptureLimits`; HTML reports default it to `full`, other output defaults to `none`
5. **Skip link test** — tab through first 5 elements, detect skip link patterns, press Enter, verify focus moves to `<main>`, `[role="main"]`, `#main-content`, `#content`, or `#main`. If a skip link was found, **reload the page** (re-running prepare) before the main tab crawl, since activating it can leave custom elements in a mutated state that would otherwise corrupt the crawl
6. **Interactive element discovery** — inject `GET_INTERACTIVE_ELEMENTS_SCRIPT` to find all interactive DOM elements (iframes are set to `tabindex="-1"` beforehand so the crawl never tabs into content Keylens can't inspect)
7. **Tab crawl** — press Tab in a loop (up to `maxTabs`), recording each focused element with selector, role, accessible name, bounding rect, page rect (absolute coords), and a computed focus-style snapshot (always captured) plus its unfocused counterpart. Tab settle delay is configurable via `--tab-delay <ms>` (default from profile, min 10ms)
8. **Cross-reference** — mark which interactive elements were reached via tab
9. **Interaction testing** (opt-in, `--interactions` / `interactions.enabled`) — click buttons and `role="button"` elements per the configured `InteractionConfig` policy (maxCases, timeout, actions, reload isolation, navigation blocking, destructive exclusion), verify focus isn't lost to `<body>`. Records `InteractionResult[]` for the `focus-after-interaction` rule
10. **Roving-tabindex verification** (always runs) — for each discovered composite widget (tablist, menu, listbox, tree, toolbar, radiogroup, grid, treegrid), simulates arrow-key presses from the active member and records which siblings actually receive focus, feeding the `roving-tabindex-broken` rule. Runs after the tab crawl and interactions since arrow-key navigation can visibly mutate page state
11. **Missing-focus-indicator pixel confirmation** (always runs) — runs last: for elements whose computed-style diff found no change, re-focuses each by selector and pixelmatch-diffs a padded screenshot of focused vs. blurred state (capped to 30 elements). Runs after roving-tabindex verification since it also re-focuses individual elements and doesn't need a pristine page state

Each phase is wrapped in an abortable, timeout-bounded `ExecutionScope` (see Key Technical Decisions); a phase timeout throws a typed `AuditTimeoutError` rather than hanging or silently truncating results.

## Conventions

- Rule files: kebab-case (`keyboard-trap.ts`), IDs match filename
- Config keys: camelCase (`keyboardTrap`, `focusOrderMismatch`)
- Types: PascalCase, all in `src/types/index.ts`
- Tests: `describe("RuleName")` with `makeFocusedElement()`/`makeCrawlResult()` factory helpers (`tests/helpers/factories.ts`)
- Path alias: `@/*` -> `./src/*` (tsconfig + vitest config)
- Pre-commit: husky + lint-staged (eslint --fix + prettier); pre-push runs `npm run validate` (format:check, lint, typecheck, benchmark:typecheck, build, docs:build, test:coverage) - a failure here blocks `git push` with no obvious reason in the short terminal output, so run `npm run validate` locally first if a push fails silently
- Config merge order: CLI flags > explicit config values > selected profile > defaults
- Unit tests (`tests/unit/**`) feed coverage thresholds; integration tests (`tests/integration/**`, real browser via `npm run test:integration`) do not

## Risks

- **Dynamic content / SPAs** - mitigated by `--wait-for` selector and configurable timeouts
- **Modals/overlays** - the main crawl only records one page state; not systematically opened. `--interactions` tests post-activation focus for eligible controls but doesn't recrawl every resulting state
- **False positives on focus order** - `focus-order-mismatch` compares Tab order against DOM order (not pixel position - WCAG 2.4.3 explicitly allows focus order to differ from visual layout), still a heuristic with a tolerance threshold
- **Focus indicator detection reliability** - focus styles vary wildly; computed-style diffing (self/ancestors/descendants) is supplemented by a bounded pixel-diff confirmation pass for whatever the style diff can't see (e.g. canvas-painted rings)
- **Bounded audits** - `maxTabs`, tab/navigation timeouts, capture budgets, interaction limits, and phase deadlines intentionally bound work; an incomplete Tab cycle can mean a trap, a large page, or an insufficient limit. See [docs/guide/limitations.md](docs/guide/limitations.md) for the full list of known limitations
