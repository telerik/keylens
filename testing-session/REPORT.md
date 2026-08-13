# Keylens Field Test — Findings Report

**Date:** 2026-08-12
**Build tested:** v0.1.0 (`dist/` built from `develop` branch, local run)
**Command pattern:** `keylens audit <url> --output json,markdown,html --screenshots --interactions --max-tabs <150-200> --tab-delay 150 --timeout 45000`

## Sites tested

| Site                                                                                                   | Category                           | Score  | Errors | Warnings | Duration |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------ | ------ | -------- | -------- |
| [w3c-apg-tabs](./w3c-apg-tabs/keylens-report.md) — W3C ARIA APG Tabs (automatic activation) example    | ARIA reference pattern             | 88/100 | 1      | 2        | 15.8s    |
| [w3c-apg-combobox](./w3c-apg-combobox/keylens-report.md) — W3C ARIA APG Combobox (select-only) example | ARIA reference pattern             | 88/100 | 1      | 2        | 15.1s    |
| [w3c-apg-dialog](./w3c-apg-dialog/keylens-report.md) — W3C ARIA APG Dialog (Modal) example             | ARIA reference pattern             | 81/100 | 8      | 2        | 46.1s    |
| [webaim](./webaim/keylens-report.md) — webaim.org                                                      | A11y consultancy ("gold standard") | 94/100 | 1      | 1        | 13.7s    |
| [gov-uk](./gov-uk/keylens-report.md) — gov.uk                                                          | Gov ("gold standard")              | 87/100 | 2      | 1        | 140.6s   |
| [nngroup](./nngroup/keylens-report.md) — nngroup.com                                                   | UX research firm                   | 85/100 | 4      | 2        | 141.5s   |

Full CLI/JSON/HTML/Markdown reports for each run are in the corresponding subfolder.

---

## Executive summary

Keylens's crawl mechanics work reliably (all 6 pages completed a full tab cycle, no crashes, no hangs). But **4 of the 8 rules produced findings that look wrong or misleading on every single site tested**, including on properties that are widely regarded as accessibility exemplars (gov.uk, webaim.org, W3C's own reference implementations). Two of these — `focus-order-mismatch` and `unreachable-elements` — have root causes I traced directly in the rule source and can point to specific fixes. The tool's core value proposition (tabbing through a real browser and recording what actually happens) is sound; the layer of heuristics interpreting that recording needs the most work before this is trustworthy for real audits.

---

## ✅ What went well

1. **The crawl itself is robust.** 6/6 sites completed full tab cycles (`cycleCompleted: true`), correctly discovered 49–88 focusable elements per page, and captured accessible names, roles, ARIA attributes, and bounding rects without errors — including on a heavy production site (gov.uk) and a JS-driven ARIA widget demo. No crashes, no silent truncation.
2. **`keyboard-trap` correctly passed on 5/6 sites** and only fired on genuine focus-repeat sequences (see the iframe caveat below — the detection logic itself, "same element focused twice in a row," is sound; it just needs iframe-awareness).
3. **`unreachable-elements` correctly identified a real accessibility gap** in `w3c-apg-tabs` — three tab buttons that are `tabindex="-1"` are, as flagged, not reachable via plain Tab. (Whether this _should_ be flagged is a separate design question — see below — but the detection is technically accurate.)
4. **`focus-after-interaction` surfaced a real, interesting signal on gov.uk, nngroup, and webaim**: clicking each site's search-submit button caused `document.activeElement` to revert to `<body>`. Whether this is a true violation or an artifact of navigation-blocking (see below) is worth a deeper look, but the underlying mechanic — click a control, then check if focus survived — works and found something non-trivial on 3/3 real-world sites tested.
5. **Reports are genuinely useful as artifacts.** The Markdown report is dense but scannable, includes WCAG references per rule, exact selectors, and tab positions — good for piping into an LLM or attaching to a ticket. The score/summary table at the top gives a fast at-a-glance signal.
6. **`computedFocusStyles` capture (outline/box-shadow/border) is valuable data** — when enabled with `--screenshots`, it captures the literal focus CSS in place. This should be leveraged more (see recommendations).

---

## ❌ What did not go well (false positives / misleading findings)

### 1. `focus-order-mismatch` is noisy to the point of being unusable

On **every single site tested**, this rule flagged the majority of the page: 83/88 elements on gov.uk, 49/61 on the W3C dialog page, 42/57 on the W3C combobox page, 37/64 on nngroup, 29/52 on W3C tabs, 27/49 on webaim. That's routinely 50–95% of all focusable elements on the page being called out as "significantly differs from visual position" — including on gov.uk, whose focus order is manually curated and industry-referenced as a good example.

**Root cause** (confirmed in [focus-order-mismatch.ts](/Users/penkov/Work/keylens/src/rules/focus-order-mismatch.ts)): the rule globally sorts _all_ focusable elements by `(y, then x)` with a flat 50px row-grouping threshold, then compares each element's position in that single global sort to its Tab position, flagging anything off by more than 3 slots. This assumption — that a "correct" tab order is a single strict top-to-bottom, left-to-right scan of the whole page — breaks down immediately on any real layout with:

- multi-column footers (links in column 2 get a very different X than column 1, but similar Y, and true reading order is column 1 top-to-bottom then column 2 top-to-bottom, not a strict row scan across all columns)
- headers with logo + nav + search all roughly on the same row
- sidebars, cards, or grids

Since virtually all modern sites have grid/flex layouts (not a strict single-column flow), this rule currently fires on the vast majority of any real page's elements. It produced no actionable signal in this test — a real reviewer can't act on "80 elements are wrong" as a report.

**Fix direction:** detect and respect layout "blocks" (header/nav/main/footer, or CSS grid/flex containers) and only compare order _within_ a block, or scope reading-order comparisons to sibling groups instead of a single global sort. Alternatively, tighten this to only flag isolated large jumps (e.g., an element that skips backward across the whole page) rather than blanket-flagging entire sections.

### 2. `unreachable-elements` fires on correctly-implemented ARIA composite widgets (roving tabindex)

On [w3c-apg-tabs](./w3c-apg-tabs/keylens-report.md), `#tab-2`, `#tab-3`, `#tab-4` were flagged as unreachable interactive elements — an **error**, WCAG 2.1.1. But these are `role="tab"` elements with `tabindex="-1"`, which is the textbook-correct **roving tabindex** pattern: only the active tab is a Tab stop; the other tabs are reached via **arrow keys** once focus lands in the tablist, not via Tab. This is literally the reference implementation of the pattern from the W3C's own APG.

**Root cause** (confirmed in [selectors.ts](/Users/penkov/Work/keylens/src/utils/selectors.ts:132) and [unreachable-elements.ts](/Users/penkov/Work/keylens/src/rules/unreachable-elements.ts)): the interactive-element discovery script includes `[role="tab"]` (and similar composite-widget roles) as a candidate unconditionally, while the generic `[tabindex]` selector explicitly excludes `tabindex="-1"`. The `[role="tab"]` (and presumably `[role="menuitem"]`, `[role="option"]`) selectors don't have the same exclusion, so any properly-built roving-tabindex widget (tabs, menus, listboxes, toolbars, radiogroups) will systematically trip this rule.

**Fix direction:** exclude elements with `tabindex="-1"` that live inside a recognized composite container (`role="tablist"`, `role="menu"`, `role="listbox"`, `role="toolbar"`, `role="radiogroup"`) from the "must be Tab-reachable" check, and instead verify they're reachable via arrow keys from the active member (this is exactly what the existing `classifyWidgets()` AI feature already knows how to detect — it's just not wired into this rule).

### 3. `keyboard-trap` false-positives on iframes

On [w3c-apg-dialog](./w3c-apg-dialog/keylens-report.md), the same iframe element (`#at-support > iframe.support-levels-modal-dialog`) was flagged as a keyboard trap **7 times** (8 total errors), driving the score down to 81/100 — the worst score of any site tested, including because of this alone.

**Root cause** (confirmed in [keyboard-trap.ts](/Users/penkov/Work/keylens/src/rules/keyboard-trap.ts)): the heuristic is "same selector focused on two consecutive Tab presses = trap." Playwright's `page.keyboard.press('Tab')` at the top-level frame doesn't traverse into iframe content the way the crawler's `document.activeElement` query expects; when focus moves _inside_ an iframe's document, the outer frame still reports the `<iframe>` element itself as the "focused" element for every tab press that stays within it. The crawler has no visibility into what's happening inside the iframe, so it looks identical to a real trap.

**Fix direction:** either (a) don't run the trap heuristic on iframe elements at all and flag them as "not inspectable, manual check recommended" instead of an error, or (b) attempt to enter the iframe's execution context (`frame.evaluate`) to track focus within it, which is a bigger lift but would make the crawler iframe-aware — valuable since embedded widgets (chat, payment, video, ad) are extremely common on real sites.

### 4. `skip-link` false-negatives against a well-known JS skip-link widget

All 3 W3C APG pages were flagged "no skip navigation link found among the first focusable elements" — but the pages load `skipto.js` (Jon Gunderson's widely-used accessible skip-navigation widget), and a real `<a class="button--skip-link" href="#main">Skip to content</a>` exists in the source. The crawler's own tab sequence shows a `skip-to-content` element landing at the **very last** tab position (#52/#57/#61) rather than near the front — meaning the widget's dynamically injected control isn't in the "first 5 elements" window the skip-link test checks, and/or the widget manages its own focus/keyboard handling in a way the sequential Tab crawl doesn't observe correctly.

**Fix direction:** worth specifically testing keylens against sites using `skipto.js` (it's used across most W3C/WAI pages) to understand whether it's a timing issue (widget injects after the crawler's first-5-elements check already ran) or a focus-management issue (widget intercepts Tab natively via JS, so the natural DOM Tab order doesn't reflect it). This is a large and popular library — this is a real gap.

### 5. `missing-focus-indicator` contradicted its own captured data on gov.uk

On [gov-uk](./gov-uk/keylens-report.md), the homepage search input (`#search-main-…`) was flagged with **error** severity: "no visible change between focused and unfocused states." But the same crawl run's `computedFocusStyles` for that exact element recorded:

```
outline: "rgb(255, 221, 0) solid 3px"
boxShadow: "rgb(0, 0, 0) 0px 0px 0px 4px inset"
```

That's GOV.UK's signature, deliberately high-contrast yellow focus outline plus a 4px inset border — one of the most well-documented, intentionally visible focus styles in the industry. Two of the tool's own signals directly contradict each other here, and the more alarming one (pixel-diff "error") is what reached the report, while the corroborating computed-style data was captured but never cross-checked.

**Fix direction:** when `computedFocusStyles` shows a non-empty `outline`/`boxShadow` change was applied, don't let the pixel-diff rule silently override it with "no indicator" — either use the computed style as a corroborating/overriding signal, or investigate why the pixel diff missed a change this large (candidates: scroll position drift between the "focused" and "unfocused" captures since `pageRect` uses absolute page coordinates; an autocomplete dropdown appearing on focus and shifting layout). This needs a repro with the raw screenshot pair, which the tool doesn't currently expose anywhere (see recommendation below).

### 6. `focus-after-interaction` fired on search-submit buttons that trigger real page navigation

On gov.uk, nngroup, and webaim, clicking the site search's submit button was flagged as "focus lost — activeElement reverted to body." Search submission is _expected_ to navigate the page (or update the results client-side), so losing DOM focus is likely a natural consequence of navigation, not a genuine accessibility bug — unless keylens's own navigation-blocking (`interactions.navigation: "block"`, on by default) failed to intercept it. If navigation-blocking worked, this should have been recorded as `status: "skipped", reason: "navigation-blocked"` rather than `"failed"`, per the code path in [crawler/index.ts](/Users/penkov/Work/keylens/src/crawler/index.ts:1283). Getting `"failed"` on 3/3 real search buttons suggests either the block isn't catching these specific requests (e.g., client-side fetch/XHR-driven search widgets don't count as a Playwright "navigation request"), or a race between the click's DOM mutation and the focus check.

**Fix direction:** confirm whether these are real top-level navigations or client-rendered result swaps; if the latter, `page.route` navigation-blocking won't catch them and the rule needs to distinguish "focus moved because the DOM node was replaced by an XHR-driven re-render" from "focus was silently dropped."

---

## 🚧 What it lacks

- **No way to visually inspect the evidence behind a violation.** The `missing-focus-indicator` rule makes its call via pixel-diffing two screenshots, but neither the HTML report nor the JSON report exposes those before/after crops anywhere. When the rule disagrees with itself (see gov.uk case above), there's currently no way for a human (or an AI agent consuming the report) to see _why_ without instrumenting the source directly, as we had to do for this test. Surfacing the focused/unfocused crop pair inline in the HTML report per violation would make every `missing-focus-indicator` and `focus-not-obscured` finding self-verifiable.
- **No layout/landmark awareness for focus-order comparisons.** As above — the biggest single quality gap. Any rule that reasons about "expected" order needs to understand that a page is composed of independent regions (header, nav, main, aside, footer; and grid/flex containers within them), not one linear list.
- **No handling of composite ARIA widgets in the reachability/order rules**, despite the codebase already having `classifyWidgets()` AI logic that identifies exactly these patterns (dialog, tabs, menu, listbox, combobox). That classification currently seems to exist only as a separate AI-opt-in feature rather than being fed back into the core (non-AI) rules that would benefit most from it (`unreachable-elements`, `focus-order-mismatch`).
- **No cross-frame (iframe) focus tracking.** Any page with an embedded widget — chat, video, payment, ads, third-party forms — will trip `keyboard-trap` as demonstrated. This is a common real-world pattern the tool currently can't see into.
- **No visibility into whether "focus lost after interaction" is due to navigation vs. a real bug**, and the built-in navigation-blocking doesn't appear reliable for client-rendered (XHR/fetch-driven) content changes, which are extremely common (search-as-you-type, filters, "load more", modal-opening buttons that don't use `<dialog>`).
- **Performance on real-world pages is significantly slower than on lean demo pages**: gov.uk and nngroup (64–88 elements) took ~140s each with `--screenshots --interactions`, roughly 9x the ~15s the W3C demo pages took for a similar element count. Worth profiling — likely candidates are the per-element screenshot capture and the interaction phase's per-candidate page reloads (`interactions.isolation: "reload"` reloads and re-preps the whole page for every clickable candidate). This matters a lot for CI use cases where audits need to run in a reasonable time budget across many URLs.
- **No confidence/severity distinction between "detected via a robust heuristic" and "detected via a rule known to have edge cases"** — e.g., `focus-order-mismatch` and `keyboard-trap`-on-iframe currently report with the same weight/severity as more reliable findings, making it hard for a report reader to know which violations deserve first attention.

---

## Bucketed findings across all 6 runs

| Rule                      | Sites triggered                                    | Assessment                                                                                                                                                           |
| ------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyboard-trap`           | 1/6 (w3c-apg-dialog)                               | **False positive** — iframe artifact, not a real trap                                                                                                                |
| `unreachable-elements`    | 1/6 (w3c-apg-tabs)                                 | **False positive** — correctly-implemented roving tabindex, flagged as a violation                                                                                   |
| `focus-order-mismatch`    | 6/6                                                | **Mostly false positive / not actionable** — fires on 27–83 elements per site regardless of actual quality                                                           |
| `tabindex-abuse`          | 0/6                                                | No findings either way — untested by this batch (no positive tabindex values encountered)                                                                            |
| `missing-focus-indicator` | 4/6                                                | **Mixed** — flagged 1–5 elements per site; the gov.uk case is a demonstrated false positive, others unverified but same mechanism                                    |
| `skip-link`               | 4/6                                                | **Mixed** — correctly passed on gov.uk and webaim (real skip links); false-negative on all 3 W3C pages (skipto.js widget not recognized), and a real miss on nngroup |
| `focus-not-obscured`      | 1/6 (nngroup, 13 violations)                       | Plausible true positive — sticky header overlap is a common real issue; not independently re-verified in this pass                                                   |
| `focus-after-interaction` | 3/6 (gov-uk, nngroup, webaim — all search buttons) | **Likely false positive** — probably navigation/XHR-driven focus change misclassified as "lost"                                                                      |

---

## Recommendations, prioritized

1. **Fix `unreachable-elements` for roving-tabindex composite widgets** — smallest, highest-confidence fix; directly caused a wrong error on the W3C's own reference implementation.
2. **Rework `focus-order-mismatch` to be layout/region-aware** — the single biggest driver of noise across every test; in its current form it doesn't provide a usable signal.
3. **Make `keyboard-trap` iframe-aware** (at minimum, don't flag iframes as traps without deeper inspection).
4. **Cross-check `missing-focus-indicator` against `computedFocusStyles`** and expose the actual screenshot pair for any flagged element in the HTML report so findings are self-verifiable.
5. **Investigate `skipto.js` compatibility** specifically — it's a very widely deployed skip-link solution.
6. **Verify `focus-after-interaction` against known-navigating controls** (search submits) to confirm whether navigation-blocking is working as intended for XHR/fetch-driven interactions.
7. **Profile the `--screenshots --interactions` combo on real-world sites** (gov.uk/nngroup-scale) — 140s for <100 elements will not scale to larger pages or CI budgets.

## Suggested next test batch

Once the above are addressed, a good regression check would be: re-run these exact 6 URLs and confirm the false positives disappear, then expand to 3–5 more real-world sites with heavier iframes/widgets (e.g., a page with an embedded YouTube video or chat widget) to specifically validate the iframe fix, and one more roving-tabindex-heavy page (e.g., a menu bar or toolbar demo) to validate the composite-widget fix generalizes beyond tabs.
