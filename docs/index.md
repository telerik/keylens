---
layout: home

hero:
  name: Keylens
  text: Press Tab. Record what actually happens.
  tagline: Static accessibility tools tell you whether markup could work. Keylens drives a real browser and tests the keyboard path users actually get.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/telerik/keylens

features:
  - icon: ⌨️
    title: Real browser evidence
    details: Launch Chromium, Firefox, or WebKit; press Tab; and record focus order, unreachable controls, traps, overlays, and skip-link behavior.
  - icon: 📸
    title: Bounded visual capture
    details: Capture a page for HTML focus maps or opt into bounded focused/unfocused pairs for focus-indicator comparison.
  - icon: 🔄
    title: Deterministic CI contracts
    details: Stable exit codes distinguish accessibility failures from incomplete audits. JSON includes rule, coverage, capture, interaction, and score-completeness details.
  - icon: 🧩
    title: Library-first pipeline
    details: Run deterministic analysis and rendering as separate stages with progress, cancellation, and deadlines.
---

Keylens complements static accessibility analysis; it does not replace it. Use static tools
for markup and semantics, then use Keylens to verify the runtime keyboard experience.

[Install from npm](/guide/getting-started) ·
[Choose an execution profile](/guide/configuration#execution-profiles) ·
[Review known limitations](/guide/limitations)

## See it in action

This is a real `keylens audit` run — not a mockup — against a small page with three
intentional keyboard issues: a `role="button"` element with no `tabindex` (so a mouse
can click it but Tab never reaches it), a link with no visible focus state, and no
skip link.

<div class="demo-grid">

```txt
🔍 Keylens v0.1.0 — Keyboard Navigation Audit
────────────────────────────────────────────────────────────
URL: http://127.0.0.1:60542/
Focusable elements: 6
Interactive elements: 7
Unreached: 1
Tab cycle completed: Yes
Duration: 6196ms

────────────────────────────────────────────────────────────
Rules:

  ✓ keyboard-trap
  ✗ unreachable-elements — 1 issue(s)
  ● 1 interactive element(s) are not reachable via keyboard.
    └─ main > div:nth-of-type(3)
  ✓ focus-order-mismatch
  ✓ tabindex-abuse
  ✗ missing-focus-indicator — 1 issue(s)
  ● 1 element(s) show no visible change between focused and unfocused states.
    └─ main > div:nth-of-type(1) > a
  ✗ skip-link — 1 issue(s)
  ● No skip navigation link found among the first focusable elements.
  ✓ focus-not-obscured
  ✓ focus-after-interaction
  ✓ roving-tabindex-broken

────────────────────────────────────────────────────────────
Result: 2 error(s), 1 warning(s)  — Score: 89/100
```

<div class="demo-image">
<img src="/demo-focus-map.png" alt="Keylens HTML report focus-order map: numbered markers 1 through 6 connected by dashed lines over the demo page, with marker 4 (a link with no visible focus indicator) highlighted in red as a violation." />
<p class="demo-caption">The same run's HTML report — numbered Tab stops with a red marker on the violation.</p>
</div>

</div>

[Full CLI output](/demo-cli-output.txt) is also available unedited.
