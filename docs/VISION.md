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
- **Classify widgets with AI** — identify APG patterns (dialog, menu, tabs, accordion) and report expected keyboard behaviors
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

### 2. Problem Detection Rules (8 implemented)

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
│   ├── ai/index.ts          # Optional AI analysis layer (Anthropic Claude)
│   ├── types/index.ts       # All core types (AuditReport, etc.)
│   ├── errors.ts            # Custom error hierarchy
│   └── utils/
│       ├── config.ts        # Config loading and deep merging
│       ├── logger.ts        # Leveled logging (debug/info/warn/error/silent)
│       └── selectors.ts     # Browser-injected scripts for element discovery
├── tests/
│   ├── unit/                # Vitest unit tests (rules, reporters, utils, AI)
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
- **Per-element focused/unfocused screenshots** — during tab crawl, captures focused state of current element + unfocused state of previous element (which just lost focus); used only by the AI focus-indicator-quality feature (contrast/visibility scoring), not for presence detection
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
| AI widget classification     | No               | No                     | Yes, APG pattern detection with confidence scores   |
| AI vision-based analysis     | No               | No                     | Yes (focus order, name inference, fix suggestions)  |
| AI-powered analysis          | No               | No                     | Optional (fix suggestions, summaries, etc.)         |

---

## High-Impact AI Features (All Implemented)

### 1. Intelligent Focus Order Validation (Implemented)

This is the single hardest problem in keyboard nav testing — determining if the focus order is "logical." Left-to-right, top-to-bottom is a heuristic, not a rule. A sidebar nav before main content might be perfectly fine. A two-column layout has ambiguous "correct" order.

**AI approach:** `validateFocusOrder()` annotates the page screenshot with numbered circle markers at each focus position using `annotateFocusOrder()`, then sends the annotated image along with focus sequence metadata to the vision model. Returns a structured `AIFocusOrderResult` with a summary, per-element issues (with severity and suggestions), and an overall assessment (`good`, `acceptable`, or `poor`). Falls back to text-only analysis when no screenshot is available.

```
AI Focus Order Analysis: acceptable
  ⚠ Element #8 (sidebar link): Receives focus before main content
    Suggestion: Move sidebar nav after main content in DOM or use tabindex
  Summary: Tab order generally follows visual layout with one
  notable exception in the sidebar region.
```

This is a genuine differentiator — no tool does this today.

### 2. Auto-Generated Fix Suggestions (Implemented)

When the tool detects issues (keyboard trap, unreachable element, missing focus style), `generateFixSuggestions()` inspects the actual HTML/CSS of the offending element and generates a structured `FixSuggestion` with before/after code, WCAG reference, effort estimate (`low`/`medium`/`high`), and explanation. When `--screenshots` is enabled, computed focus styles (outline, boxShadow, border) are included for richer context. Falls back to plain-text suggestions when structured output can't be parsed.

```
✗ KEYBOARD TRAP at <div role="combobox" class="search-dropdown">

  AI Fix [effort: medium] [WCAG 2.1.2]:
  Allow Tab/Shift+Tab to pass through the combobox keydown handler.

  Before:
  onKeyDown={(e) => e.preventDefault()}

  After:
  onKeyDown={(e) => {
    if (e.key === 'Tab') return;
    e.preventDefault();
  }}
```

### 3. Accessible Name & Role Inference (Implemented)

`inferAccessibleNames()` examines interactive elements with empty or generic accessible names using the vision model. For each element, it provides a suggested `aria-label`, optional corrected role, confidence score (0–1), and reasoning. Up to 10 elements are analyzed per audit.

```
⚠ UNNAMED INTERACTIVE ELEMENT
  <button class="icon-btn-23">
    Contains: <svg> (hamburger menu icon)

  AI Suggestion (confidence: 0.91):
  aria-label="Open navigation menu"
  Reasoning: SVG appears to be a 3-line hamburger icon,
  positioned in the header next to the site logo.
```

### 4. Widget Classification (Implemented)

The hardest part of keyboard testing is knowing what to interact with and what should happen after. A modal button should open a modal and trap focus. A dropdown should expand and allow arrow key navigation. An accordion should toggle and move focus.

**AI approach:** `classifyWidgets()` filters interactive elements to complex ARIA roles (excluding generic button/link/textbox), sends up to 20 element descriptions to Claude, and receives APG pattern classifications with confidence scores and expected keyboard behaviors.

Supported patterns: `dialog`, `menu`, `accordion`, `tabs`, `combobox`, `disclosure`, `tooltip`, `unknown`.

```
Element: <button class="faq-toggle">
AI Classification: Accordion trigger (confidence: 0.92)
Expected Keyboard:
  - Enter/Space: Toggle panel
  - Arrow Down: Move to next accordion header
  - Home/End: Move to first/last header
```

Results appear in both CLI and HTML reports. Classifications with confidence below 0.5 are filtered out.

---

## Medium-Impact AI Features

### 5. Focus Indicator Quality Scoring

Beyond just detecting if a focus indicator exists (via screenshot diff), use a vision model to evaluate how good it is. Is it high contrast? Is it clearly visible against the background? Does it look like an intentional design choice or a barely-visible browser default?

```
Element: <a class="card-link">
Focus indicator detected: Yes
AI Quality Score: 2/10
Reasoning: "Default browser outline is present but the element
has a dark background (#1a1a2e) and the outline is a thin
dotted line in dark gray — effectively invisible. Recommend
a 2px solid outline in a contrasting color or a visible
box-shadow."
```

### 6. Natural Language Report Summaries

Generate a human-readable executive summary of the audit results, suitable for sharing with non-technical stakeholders (product managers, designers, compliance teams).

```
Summary:
"This page has 47 interactive elements, of which 42 are reachable
by keyboard. The main issues are a search dropdown that traps
keyboard focus (critical — users cannot escape it), and 5 buttons
in the image carousel that are completely unreachable without a
mouse. The tab order generally follows the visual layout, except
in the footer where social media links are focused before the
contact form. Estimated fix effort: 2-4 hours for a frontend
developer."
```

### 7. Cross-Page Pattern Detection (Removed)

An earlier iteration explored using AI to identify inconsistent keyboard patterns across a multi-page scan (e.g. a nav bar with a different focus order on the homepage vs. the pricing page). Multi-page auditing was removed, so this feature no longer exists.

---

## AI Integration Architecture

Two modes — offering both is the right call:

### Option A: Cloud API (Default)

```bash
# Uses Claude API for analysis
npx keylens https://example.com --ai
```

- Requires an API key (user provides their own)
- Best results, especially for vision-based features
- Privacy consideration: screenshots are sent to the API

### Option B: Local/Offline Mode

```bash
# No AI, pure heuristic checks only
npx keylens https://example.com
```

- All geometric/DOM-based rules work without AI
- Zero dependencies on external services
- Good baseline — AI enhances but isn't required

**This is important for adoption:** the tool must be fully useful without AI. The AI features are a premium layer on top. This avoids the trap of building something that's useless without an API key.

### Suggested Config

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
      "accessibleNameInference": false
    }
  }
}
```

---

## Roadmap

### Phase 1 (Complete)

- Tab crawling + focus order map
- 7 rules: keyboard trap, unreachable elements, focus order mismatch, tabindex abuse, missing focus indicator, skip link, focus not obscured
- CLI + JSON + HTML reporters
- Optional AI layer (fix suggestions, focus order validation, report summaries)
- Single-page scan

### Phase 2 (Complete)

- Skip link functional testing — crawler tests Enter + focus target verification
- Per-element screenshot capture — `--screenshots` flag, focused/unfocused pairs
- Focus indicator screenshot diffing — pixelmatch comparison, severity "error" when confirmed
- HTML visual report with focus overlay — numbered markers on page screenshot with SVG connecting lines, violation markers colored red
- HTML output XSS protection — all user-supplied content escaped

### Phase 3 (Complete)

- Bounded post-activation interaction testing — `--interactions` enables the configured safety policy and the `focus-after-interaction` rule (WCAG 2.4.3/2.4.7, error severity)
- AI widget classification — `classifyWidgets()` identifies APG patterns (dialog, menu, tabs, accordion, combobox, disclosure, tooltip) with confidence scores and expected keyboard behaviors. Results displayed in CLI and HTML reports

### Phase 5 (AI High-Impact — Complete)

- Vision-based focus order validation — `annotateFocusOrder()` draws numbered markers on screenshot, sent to vision model via `queryVision()`, returns structured `AIFocusOrderResult` with per-element issues and overall assessment
- Structured fix suggestions — `generateFixSuggestions()` returns `FixSuggestion` with before/after code, WCAG reference, effort estimate; includes computed focus styles when `--screenshots` enabled
- Accessible name inference — `inferAccessibleNames()` uses vision model to suggest aria-labels for unnamed elements with confidence scores and reasoning
- Shared `queryVision()` infrastructure — private method on `AIAnalyzer` for sending image+text content blocks to Anthropic vision API
- Computed focus styles capture — crawler records `outline`, `boxShadow`, `border` during tab crawl

### Phase 6 (AI Medium-Impact — Complete)

- Focus indicator quality scoring — `scoreFocusIndicatorQuality()` sends focused/unfocused screenshot pairs to vision model, returns `FocusIndicatorScore` with score (1-10), contrast assessment, visibility assessment, and improvement recommendations. Only scores elements with confirmed focus indicators (`hasFocusIndicator === true`) and both screenshots present. Limited to 10 per audit
- Enhanced structured report summaries — `generateSummary()` returns structured `AIReportSummary` with overview, critical issues, prioritized fixes (with effort/impact), an AI severity rating (1-100), and recommendation. Falls back to plain string for backward compatibility
- Cross-page pattern detection (removed) — an earlier `detectCrossPagePatterns()` feature used heuristic pre-filtering (`findSharedSelectors`, `findSkipLinkInconsistencies`) plus AI to detect inconsistent tab order, missing components, inconsistent focus styles, and skip link inconsistencies across pages. Removed along with multi-page auditing

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

**Focus indicator detection reliability:** Focus styles vary wildly. Uses a computed-style diff (outline, box-shadow, border, background, color, pseudo-elements, parent) between focused and unfocused snapshots — any difference counts as a visible indicator. Runs by default; per-element screenshots (`--screenshots`) are a separate, opt-in input to the AI focus-indicator-quality scoring feature, not to presence detection.

---

## Go-to-Market for Open Source

- Write a launch blog post showing a real-world audit of a popular site (gov.uk, github.com, etc.) with the visual report
- Post to Hacker News, Reddit r/webdev, r/accessibility, Dev.to
- Submit to the W3C's WAI Tools listing
- Reach out to Deque and Accessibility Insights teams — they may link to it as complementary
- The accessibility community on Twitter/Mastodon is very active and supportive of new tools
