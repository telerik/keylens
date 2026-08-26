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

[Install from GitHub Packages](/guide/getting-started) ·
[Choose an execution profile](/guide/configuration#execution-profiles) ·
[Review known limitations](/guide/limitations)
