---
layout: home

hero:
  name: Keylens
  text: Test the keyboard path users actually take.
  tagline: Keylens drives a real browser, follows the tab order, and reports where keyboard navigation breaks.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/telerik/keylens

features:
  - icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><rect x="2" y="5" width="20" height="14" rx="2"/><g fill="currentColor" stroke="none"><circle cx="6" cy="9" r="0.9"/><circle cx="10" cy="9" r="0.9"/><circle cx="14" cy="9" r="0.9"/><circle cx="18" cy="9" r="0.9"/><circle cx="6" cy="13" r="0.9"/><circle cx="10" cy="13" r="0.9"/><circle cx="14" cy="13" r="0.9"/><circle cx="18" cy="13" r="0.9"/></g><line x1="8" y1="16" x2="16" y2="16"/></svg>'
    title: Real browser evidence
    details: Launch Chromium, Firefox, or WebKit; press Tab; and record focus order, unreachable controls, traps, overlays, and skip-link behavior.
  - icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>'
    title: Bounded visual capture
    details: Capture a page for HTML focus maps. Focus-indicator checks automatically confirm ambiguous elements with a bounded focused/unfocused pixel comparison.
  - icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M20 11a8 8 0 0 0-14.93-3.5"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.93 3.5"/><path d="M20 20v-4h-4"/></svg>'
    title: Deterministic CI contracts
    details: Stable exit codes distinguish accessibility failures from incomplete audits. JSON includes rule, coverage, capture, interaction, and score-completeness details.
  - icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color:var(--vp-c-brand-1)"><path d="M9 4h4a1 1 0 0 1 1 1v1.2a1.6 1.6 0 0 0 2.9 1A1.6 1.6 0 0 1 20 8.6V12a1 1 0 0 1-1 1h-1.2a1.6 1.6 0 0 0-1 2.9 1.6 1.6 0 0 1-1.4 2.5H12a1 1 0 0 1-1-1v-1.6a1.6 1.6 0 0 0-2.9-1A1.6 1.6 0 0 1 4 13.9V10a1 1 0 0 1 1-1h1.6a1.6 1.6 0 0 0 1-2.9A1.6 1.6 0 0 1 9 4Z"/></svg>'
    title: Library-first pipeline
    details: Run deterministic analysis and rendering as separate stages with progress, cancellation, and deadlines.
---

## Why runtime keyboard testing?

Static analysis can identify interactive elements and inspect their semantics. Keylens
adds the missing runtime question: **can a person actually move through the page with a
keyboard?**

<div class="keylens-comparison">
  <article>
    <span class="keylens-comparison-label">Static analysis</span>
    <h3>What the markup allows</h3>
    <p>Inspect roles, names, states, and relationships in the rendered DOM.</p>
  </article>
  <article>
    <span class="keylens-comparison-label">Keylens</span>
    <h3>What the browser delivers</h3>
    <p>Press Tab, observe focus, and report the controls and states users can reach.</p>
  </article>
</div>

## Built for CI and local debugging

Run the same audit from a terminal, a test script, or an MCP client. Use the terminal
report while fixing a page, then switch to JSON for a repeatable CI contract.

<div class="keylens-code-grid">
  <div>
    <h3>Run an audit</h3>
    <CopyCommand
      command="npx keylens audit https://example.com"
      label="audit command"
    />
    <a href="./guide/cli">Explore the CLI reference →</a>
  </div>
  <div>
    <h3>Automate the result</h3>
    <CopyCommand
      command="npx keylens audit https://example.com --output json"
      label="CI command"
    />
    <a href="./guide/ci-cd">Set up CI/CD →</a>
  </div>
</div>

<p class="keylens-home-links">
  <a href="./guide/getting-started">Getting started</a>
  <a href="./rules/">Explore the rules</a>
  <a href="./api/">Programmatic API</a>
  <a href="./guide/limitations">Known limitations</a>
</p>
