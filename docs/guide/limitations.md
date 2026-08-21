# Known limitations

Keylens provides evidence about one automated keyboard path in one browser state. It is
not a WCAG conformance checker and does not replace manual keyboard, screen reader,
zoom, contrast, or static semantic testing.

## Dynamic pages and waiting

Navigation waits for `domcontentloaded`, optionally waits for one CSS selector, then
uses a fixed delay. The selector wait uses `tabTimeout`; navigation uses
`navigationTimeout`.

This does not guarantee that background requests, streamed UI, lazy routes, animation,
virtualized lists, or later state changes are complete. A page can mutate while the Tab
crawl is running, which can change selectors, focus order, and element counts.

Expose an application-ready marker, use a suitable fixed delay, stabilize changing
data, and audit significant routes and states independently.

## One state, overlays, and composite widgets

The main crawl records the state present after initial load and skip-link probing. It
does not systematically open every modal, menu, accordion, tab panel, or disclosure.
Hidden controls can therefore be absent, while controls behind an open overlay can
appear unreachable.

Experimental interactions test post-activation focus for eligible controls; they do
not recrawl every resulting state or verify full widget keyboard patterns. Use
state-specific URLs or fixtures and manual tests for overlays and composite widgets.

The skip-link probe recognizes text patterns among the first five focus stops. Its
functional pass currently establishes only that focus is not lost to the document
after Enter; it does not prove that the destination is main content or matches the
fragment target.

## Iframes and shadow DOM

Discovery and focused-element inspection run against the top-level `document`.
Keylens does not traverse iframe documents or shadow roots, and cannot see what's
focused inside them. Before the tab crawl starts, all `<iframe>` elements are set to
`tabindex="-1"` so keyboard navigation skips over them entirely instead of tabbing
into content Keylens can't inspect or report on — iframes are never recorded in the
focus sequence or interactive element list. Audit iframe documents as separate URLs
and test shadow-root internals with component-specific automation.

## Cookie/consent auto-dismissal

The prepare phase dismisses cookie/consent banners before the crawl using built-in CMP
presets and a generic heuristic fallback. This is best-effort, not exhaustive:

- Unrecognized or heavily customized CMPs may not match any preset or the heuristic's
  text/z-index pattern, leaving the banner in place.
- The heuristic's consent-button matching is English-only. Sites that serve a
  localized/non-English banner (including consent screens served in a different
  language based on the visitor's geolocation, independent of browser locale) may not
  be dismissed unless a dedicated preset is added for that CMP.
- The heuristic can occasionally click the wrong control, or none, on non-CMP overlays
  that happen to mention "cookie"/"consent"/"privacy" text.
- A dismissal is only marked `verified` if the container becomes hidden/detached within
  its timeout; some CMPs animate closed slower than that window, so a real dismissal can
  still be reported as unverified.
- The whole phase has a bounded budget (`prepare.timeout`, default 5s); a stuck or
  slow-loading banner degrades to a warning rather than blocking the audit, and the
  banner may still appear in the focus sequence.
- Presets target the CMP's default markup; heavily customized/white-labeled
  installations of a supported CMP can still fall through to the heuristic or go
  undetected.

Always check `crawl.prepare.dismissals`/`crawl.prepare.warnings` (or the CLI/HTML/
Markdown "Overlays dismissed"/"Prepare warnings" lines) rather than assuming a banner
was handled. Use `--dismiss <selector>` for a known banner the built-ins miss, or
`--keep-overlays` to audit the banner deliberately.

## Focus screenshots

`--screenshots` captures a clipped PNG for an element while focused and another after
focus moves. These images are not used by `missing-focus-indicator` — that rule always
runs via a computed-style diff instead (see below). Screenshot pairs feed only the AI
focus-indicator-quality feature, which scores contrast/visibility of indicators already
confirmed present; it is not a contrast measurement or WCAG Focus Appearance proof on
its own.

Capture limits can skip a page image or focus pairs without failing the audit. Review
CLI pair coverage, `crawl.capture`, and screenshot IDs before interpreting AI
focus-indicator-quality scores.

## Focus indicator detection

`missing-focus-indicator` diffs a computed-style snapshot (outline, box-shadow, border,
background, color, `::before`/`::after`, and the immediate parent for `:focus-within`
patterns) taken while an element was focused against one taken once focus moved away —
always, with no flag required. Any difference counts as a visible indicator.

This is more reliable than a text-based CSS scan (it reflects the real cascade,
including JS/attribute-toggled classes), but it is not a contrast measurement or proof
of WCAG Focus Appearance conformance. Indicators implemented via canvas drawing, or
whose visual delta only appears mid-transition before settling, can still be missed.

## Page screenshots and HTML maps

Page capture is independent from focus-state pairs. HTML maps need a page image and
page dimensions; without an image, the report degrades to nonvisual content. Viewport
capture represents only the initial viewport, while focus coordinates can span the
document. Full-page capture can be skipped when dimensions, pixels, or bytes exceed the
configured budget.

Sites that implement scrolling with a nested `overflow: auto` container instead of the
document itself (parallax/smooth-scroll designs) are heuristically detected and
neutralized during the prepare phase (`prepare.expandScrollContainers`, on by default)
so page dimensions and full-page screenshots reflect the true page length. The
heuristic can misfire on unusual layouts — disable it with
`--no-expand-scroll-containers` if a legitimate scrollable region gets expanded
unexpectedly, and check `crawl.prepare.scrollContainerExpanded` in the JSON report to
see what was detected.

## Experimental interaction safety

Interactions are opt-in because activation can mutate data or application state.
Default safeguards reload before each case, block top-level navigation, exclude labels
matching a limited destructive-word pattern, cap cases, and apply per-operation and
phase timeouts.

Safeguards are heuristic. They cannot recognize every destructive, financial,
privacy-sensitive, or irreversible action; they do not roll back server-side effects.
Navigation-blocked cases are skipped, and reload isolation can differ from a real user
session. Restrict `include` to known-safe controls and use disposable test data.

Detailed results distinguish `passed`, `failed`, `skipped`, and `error`. An interaction
error makes `focus-after-interaction` a rule evaluation error only when no failed focus
case already exists; inspect JSON rather than relying only on the terminal summary.

## Browser and environment differences

Chromium, Firefox, and WebKit can differ in native focus rings, sequential focus rules,
platform preferences, form controls, font metrics, scrolling, and screenshot output.
Headed and headless environments, operating systems, installed fonts, reduced-motion
settings, and device scale can also change results. A pass in one environment does not
establish a pass in another; pin CI and run separate browser jobs where required.

## Focus-order heuristic

The focus-order rule sorts rectangles top-to-bottom and then left-to-right for elements
within 50 pixels vertically. It warns when an element differs by more than three
positions. This is not language-direction aware and cannot understand intended reading
order, component semantics, responsive relationships, or legitimate alternate
sequences. Treat findings as review prompts.

## Bounded and incomplete audits

`maxTabs`, Tab timeouts, capture budgets, interaction limits, phase deadlines, and
aborts intentionally bound work. An incomplete Tab cycle may indicate
a trap, a large page, unstable focus, or simply an insufficient limit. Skipped captures
reduce visual-rule coverage.

A rule evaluator failure is reported separately from a violation, sets
`scoreComplete: false`, and causes CLI exit code `2`. The numeric score still exists
for diagnostics but must not be compared as a complete score.

## AI

AI and MCP are experimental. AI output is nondeterministic, provider/model dependent,
and can be wrong. Enabled features can send HTML snippets, selectors, accessible names,
focus metadata, report data, and screenshots to a provider or MCP client's model.
Provider retention, training, residency, and access policies apply.

Do not send sensitive pages without organizational approval. Validate suggestions with
deterministic results and manual testing, and do not use AI ratings as CI gates.
