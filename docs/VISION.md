# Keylens Vision

## Competitive Landscape

What exists today — and where the gaps are:

**Static analysis tools (axe-core, Pa11y, Lighthouse):** These are the dominant players. They scan the DOM for ARIA violations, missing labels, contrast issues, etc. But here's the key insight: none of them actually simulate keyboard navigation. They check if elements could be focusable in theory, but they don't press Tab and walk through the page. Lighthouse even has a manual audit called "logical tab order" that it explicitly marks as requiring human review — it can't automate it.

**Microsoft Accessibility Insights:** The closest thing to what you'd build. It has an assisted "Tab Stops" feature in its Chrome extension that numbers elements as you manually tab through them. It's good, but it's manual, browser-extension-only, not scriptable, and can't run in CI. It also recently added some auto-detection of potential tab stop issues, but it's limited.

**Browser dev tools:** Firefox has "Show tabbing order" in its Accessibility Inspector. Chrome has "Show source order" (which is different — it shows DOM order, not focus order). Polypane has tab order visualization. These are all manual, visual, in-browser-only.

**Taba11y Chrome extension:** Visualizes focus order on any page. Simple, useful, but again — manual, browser-only, no CI integration.

**focus-trap / tabbable (npm):** These are utilities for building focus traps, not testing tools. tabbable computes which elements are tabbable in a given container — that's actually a useful primitive you could build on.

**The gap:** There is no CLI tool that programmatically tabs through a page, records the actual focus sequence, detects problems, and outputs a report. This is a genuine hole in the ecosystem.

---

## What Keylens Does

A CLI tool that uses Playwright under the hood to:

- **Map the complete focus order** — tab through every element, record what gets focus and in what sequence
- **Detect problems automatically** — keyboard traps, unreachable interactive elements, illogical order, missing focus indicators, focus lost after interactions, skip link issues, obscured focus
- **Test post-click interactions** — click buttons and verify focus isn't lost, with opt-in `--interactions` flag
- **Output actionable reports** — CLI summary, JSON for CI, and an interactive HTML report with a visual focus-order map

---

## Core Feature Set (MVP)

### 1. Focus Order Mapping

- Launch headless browser, navigate to URL
- Programmatically press Tab repeatedly until focus cycles back to start
- Record each focused element: selector, accessible name, role, bounding rect, page rect (absolute coords), tab index
- Capture page dimensions and an optional bounded page screenshot for report overlays
- Compare focus order to visual layout order (left-to-right, top-to-bottom)
- Output a numbered focus sequence

### 2. Problem Detection Rules (9 implemented)

- **Keyboard trap** (WCAG 2.1.2): forward Tab appears stuck (detected via consecutive duplicate selectors) or does not complete a cycle
- **Unreachable interactives** (WCAG 2.1.1): `<button>`, `<a href>`, `<input>`, etc. discovered on page but never reached via Tab
- **Focus order vs visual order mismatch** (WCAG 2.4.3): element position in tab sequence doesn't match its screen position (with tolerance for minor discrepancies)
- **Positive tabindex abuse** (WCAG 2.4.3): any `tabindex > 0` detected — disrupts natural tab order
- **Missing focus indicator** (WCAG 2.4.7): computed-style diff — compares outline, box-shadow, border, background, color, pseudo-elements, and parent styles taken while focused vs. once focus moves away. Runs by default (no flag needed); any difference counts as a visible indicator (severity: error)
- **Skip link** (WCAG 2.4.1): crawler tabs through the first 5 elements, identifies a skip-link pattern, presses Enter, and records the resulting focus target. The current pass check only establishes that focus is not lost to the document; manual destination verification remains necessary
- **Focus not obscured** (WCAG 2.4.11): checks if focused elements are hidden behind overlays or other content using `elementFromPoint` at the element's center
- **Focus after interaction** (WCAG 2.4.3, 2.4.7): when experimental interactions are enabled, runs bounded configured activations against eligible controls and verifies focus remains on a valid target. Each failed interaction is a separate error-severity violation

### 3. Report Outputs

- **CLI:** colored terminal output with pass/fail/warning per rule
- **JSON:** machine-readable for CI integration; binary assets omitted. CLI exit codes distinguish accessibility failures (`1`) from incomplete audits (`2`)
- **HTML:** interactive visual focus order map — page screenshot as background with numbered circle markers at each focused element, SVG dashed connecting lines between consecutive markers, violation markers colored red

---

## Example CLI Interface

```bash
# Basic scan
npx keylens https://example.com

# With options
npx keylens https://example.com \
  --output html \
  --interactions \
  --wait-for "#app-loaded"

# Config file
npx keylens --config keylens.config.json
```

### Example Output

```
keylens v<current> — Keyboard Navigation Audit

URL: https://example.com
Focusable elements found: 47
Tab cycle completed: 42 elements reached

✗ TRAP DETECTED at element #12
  <div role="combobox" class="search-dropdown">
  Focus remained on the same element during forward Tab navigation

✗ 5 UNREACHABLE INTERACTIVE ELEMENTS
  <button class="carousel-next"> — not in tab order
  <a href="/pricing" class="nav-link"> — hidden but interactive
  ...

⚠ FOCUS ORDER MISMATCH (3 instances)
  Element #8 (sidebar link) appears before Element #7 (main content)
  visually below but receives focus first

⚠ MISSING FOCUS INDICATOR (2 instances)
  <a class="logo-link"> — no visible focus style change detected

✓ Skip link present and functional
✓ No positive tabindex values found

Result: 2 errors, 4 warnings
```

---

## Technical Architecture

```
keylens/
├── src/
│   ├── cli/index.ts         # Commander.js CLI entry point
│   ├── crawler/index.ts     # Playwright tab crawler + skip link testing + element screenshots + interaction testing
│   ├── rules/
│   │   ├── keyboard-trap.ts       # WCAG 2.1.2 - focus trap detection
│   │   ├── unreachable-elements.ts  # WCAG 2.1.1 - interactive elements never reached
│   │   ├── focus-order-mismatch.ts  # WCAG 2.4.3 - tab order vs visual layout
│   │   ├── tabindex-abuse.ts      # WCAG 2.4.3 - positive tabindex values
│   │   ├── missing-focus-indicator.ts  # WCAG 2.4.7 - computed-style diff (focused vs unfocused)
│   │   ├── skip-link.ts          # WCAG 2.4.1 - skip link presence and functional test
│   │   ├── focus-not-obscured.ts  # WCAG 2.4.11 - focused element not hidden by overlays
│   │   └── focus-after-interaction.ts  # WCAG 2.4.3/2.4.7 - focus not lost after clicking
│   ├── reporters/
│   │   ├── cli-reporter.ts        # Terminal output
│   │   ├── json-reporter.ts       # JSON for CI
│   │   ├── html-reporter.ts       # Interactive HTML with focus map overlay
│   │   └── index.ts               # Dispatcher: runReporters
│   ├── types/index.ts       # All core types (AuditReport, etc.)
│   ├── errors.ts            # Custom error hierarchy
│   └── utils/
│       ├── config.ts        # Config loading and deep merging
│       ├── logger.ts        # Leveled logging (debug/info/warn/error/silent)
│       └── selectors.ts     # Browser-injected scripts for element discovery
├── tests/
│   ├── unit/                # Vitest unit tests (rules, reporters, utils)
│   ├── integration/         # End-to-end audit pipeline + selector tests
│   ├── fixtures/            # HTML test pages (clean-page, test-page, skip-link-broken, etc.)
│   └── helpers/factories.ts # Test factories: makeFocusedElement, makeCrawlResult, etc.
└── keylens.config.schema.json
```

### Key Technical Decisions

- **Playwright over Puppeteer** — cross-browser support (Chromium, Firefox, WebKit), better API, actively maintained
- **Rule-based architecture** — each check is a standalone module, easy to add new rules or let community contribute them
- **Computed-style diffing for focus indicators** — crawler diffs a computed-style snapshot (outline, box-shadow, border, background, color, `::before`/`::after`, and parent styles for `:focus-within`) taken while focused vs. once focus moves away. Runs by default (no flag needed) since the crawler already focuses every element for real; catches JS/attribute-driven indicators and container-level highlighting that a CSS/HTML text scan would miss
- **Skip link functional testing** — crawler tabs through first 5 elements, identifies skip links by regex pattern, presses Enter, and records the resulting focus target; current pass logic only checks that focus remains on a non-document element
- **Targeted focus-indicator pixel confirmation** — candidates missed by computed-style diffing receive a bounded focused-vs-unfocused pixel comparison; this runs automatically and is separate from page screenshot capture
- **HTML focus order overlay** — `buildFocusMapHTML()` renders page screenshot as background with numbered markers at each focused element, SVG connecting lines showing tab flow. Percentage-based positioning via `pageRect` / `pageDimensions`. Violation markers colored red
- **HTML escaping throughout** — all user-supplied strings escaped in HTML output to prevent XSS
- **Use tabbable npm package as a reference** — compare its computed tabbable list against what actually receives focus to find discrepancies

### Comparison Table

| Feature                      | axe-core / Pa11y | Accessibility Insights | Keylens                                             |
| ---------------------------- | ---------------- | ---------------------- | --------------------------------------------------- |
| Runs in CI                   | Yes              | No                     | Yes (exit codes 0/1/2)                              |
| Actually tabs through page   | No               | Manual only            | Yes, automated                                      |
| Detects keyboard traps       | No               | Manual only            | Yes                                                 |
| Focus order visualization    | No               | Manual only            | Yes, HTML overlay with numbered markers + SVG lines |
| Focus indicator detection    | No               | No                     | Yes, computed-style diff (focused vs unfocused)     |
| Skip link functional testing | No               | No                     | Yes, verifies Enter + focus target                  |
| Scriptable / configurable    | Yes              | No                     | Yes, JSON config + CLI flags                        |
| Cross-browser                | Varies           | Chrome only            | Yes, via Playwright                                 |
| Post-click interaction test  | No               | No                     | Yes, `--interactions` flag                          |

---

---

## Roadmap

### Phase 1 (Complete)

- Tab crawling + focus order map
- 7 rules: keyboard trap, unreachable elements, focus order mismatch, tabindex abuse, missing focus indicator, skip link, focus not obscured
- CLI + JSON + HTML reporters
- Single-page scan

### Phase 2 (Complete)

- Skip link functional testing — crawler tests Enter + focus target verification
- Focus indicator screenshot diffing — pixelmatch comparison, severity "error" when confirmed
- HTML visual report with focus overlay — numbered markers on page screenshot with SVG connecting lines, violation markers colored red
- HTML output XSS protection — all user-supplied content escaped

### Phase 3 (Complete)

- Bounded post-activation interaction testing — `--interactions` enables the configured safety policy and the `focus-after-interaction` rule (WCAG 2.4.3/2.4.7, error severity)

### Phase 4 (Ecosystem)

- GitHub Actions integration
- Playwright test helper (`expect(page).toHaveLogicalFocusOrder()`)
- Storybook addon
- VS Code extension that shows focus order inline
- Community-contributed rules

---

## Risks & Challenges

**Dynamic content:** SPAs that load content lazily or change DOM after interactions. Mitigation: `--wait-for` selector option, configurable timeouts.

**Modals and overlays:** Focus behavior changes based on interaction state. Experimental interactions sample bounded post-activation focus behavior but do not exhaustively crawl every resulting state.

**False positives on focus order:** "Logical" order is subjective in complex layouts. Mitigation: flag as warnings not errors, let users configure expected order.

**Focus indicator detection reliability:** Focus styles vary wildly. Uses a computed-style diff (outline, box-shadow, border, background, color, pseudo-elements, parent) between focused and unfocused snapshots, with a targeted pixel comparison for candidates whose visual change is not represented in style data. Runs by default.

---

## Go-to-Market for Open Source

- Write a launch blog post showing a real-world audit of a popular site (gov.uk, github.com, etc.) with the visual report
- Post to Hacker News, Reddit r/webdev, r/accessibility, Dev.to
- Submit to the W3C's WAI Tools listing
- Reach out to Deque and Accessibility Insights teams — they may link to it as complementary
- The accessibility community on Twitter/Mastodon is very active and supportive of new tools
