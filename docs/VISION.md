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
- **Focus order vs DOM order mismatch** (WCAG 2.4.3): element position in tab sequence differs from its position in DOM/content order by more than a tolerance (WCAG 2.4.3 explicitly allows focus order to differ from visual/pixel layout, so this intentionally does not compare screen position)
- **Positive tabindex abuse** (WCAG 2.4.3): any `tabindex > 0` detected — disrupts natural tab order
- **Missing focus indicator** (WCAG 2.4.7): computed-style diff — compares outline, box-shadow, border, background, color, pseudo-elements, ancestor, and descendant styles taken while focused vs. once focus moves away, confirmed by a bounded pixel-diff pass for whatever the style diff can't see (e.g. a canvas-painted ring). Runs by default (no flag needed); any difference (or pixel-diff confirmation) counts as a visible indicator (severity: error)
- **Skip link** (WCAG 2.4.1): crawler tabs through the first 5 elements, identifies a skip-link pattern, presses Enter, and records the resulting focus target. The current pass check only establishes that focus is not lost to the document; manual destination verification remains necessary
- **Focus not obscured** (WCAG 2.4.11): checks if focused elements are hidden behind overlays or other content using `elementFromPoint` at the element's center
- **Focus after interaction** (WCAG 2.4.3, 2.4.7): when experimental interactions are enabled, runs bounded configured activations against eligible controls and verifies focus remains on a valid target. Each failed interaction is a separate error-severity violation
- **Broken roving-tabindex navigation** (WCAG 2.1.1): for composite widgets declaring the roving-tabindex pattern (tabs, menus, listboxes, trees, toolbars, radiogroups, grids), simulates real arrow-key presses to verify every `tabindex="-1"` member is actually reachable, rather than trusting the markup alone. Always runs (no flag); reported as a warning since it's a best-effort simulation, not a structural markup check

### 3. Report Outputs

- **CLI:** colored terminal output with pass/fail/warning per rule
- **JSON:** machine-readable for CI integration; binary assets omitted. CLI exit codes distinguish accessibility failures (`1`) from incomplete audits (`2`)
- **HTML:** interactive visual focus order map — page screenshot as background with numbered circle markers at each focused element, SVG dashed connecting lines between consecutive markers, violation markers colored red

---

## Example CLI Interface

```bash
# Basic scan
npx keylens audit https://example.com

# With options
npx keylens audit https://example.com \
  --output html \
  --interactions \
  --wait-for "#app-loaded"

# Config file
npx keylens audit --config keylens.config.json
```

See [Getting started](guide/getting-started.md) and [CLI reference](guide/cli.md) for
real command output and exit codes; this doc does not duplicate them.

---

## Technical Architecture

See `AGENTS.md` in the repository root for the current source layout and technical
decisions. This vision doc intentionally does not duplicate that reference, to avoid
the two drifting apart.

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
| Post-click interaction test  | No               | No                     | Experimental, `--interactions` flag                 |

---

---

## Roadmap

### Phase 1 (Complete)

- Tab crawling + focus order map
- Core deterministic rules: keyboard trap, unreachable elements, focus order mismatch,
  tabindex abuse, missing focus indicator, skip link, focus not obscured (see
  [docs/rules/](rules/index.md) for the current full list and severities)
- CLI + JSON + HTML reporters
- Single-page scan

### Phase 2 (Complete)

- Skip link functional testing — crawler tests Enter + focus target verification
- Focus indicator screenshot diffing — pixelmatch comparison, severity "error" when confirmed
- HTML visual report with focus overlay — numbered markers on page screenshot with SVG connecting lines, violation markers colored red
- HTML output XSS protection — all user-supplied content escaped

### Phase 3 (Complete)

- Bounded post-activation interaction testing — `--interactions` enables the configured safety policy and the `focus-after-interaction` rule (WCAG 2.4.3/2.4.7, error severity)
- Broken roving-tabindex navigation rule — arrow-key simulation for composite widgets (WCAG 2.1.1, warning severity)
- Cookie/consent auto-dismissal and faux-scroll-container handling before the crawl (`prepare` phase)
- Execution profiles (`fast`/`balanced`/`thorough`), bounded capture/interaction/timeout budgets, and structured progress events

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
