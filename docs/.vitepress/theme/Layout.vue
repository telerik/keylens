<script setup lang="ts">
import { useData, withBase } from "vitepress";
import DefaultTheme from "vitepress/theme";

const { Layout } = DefaultTheme;
const { page } = useData();
const installCommand = "npm install -D @progress/keylens";

function updateHeroKeyShadow(event: PointerEvent) {
  const key = event.currentTarget as HTMLElement;
  const rect = key.getBoundingClientRect();
  const side = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const distance = Math.abs(side);

  key.style.setProperty("--klx-hero-key-shadow-x", `${-side * 22}px`);
  key.style.setProperty("--klx-hero-key-shadow-y", `${26 + distance * 8}px`);
  key.style.setProperty("--klx-hero-key-shadow-blur", `${52 - distance * 8}px`);
  key.style.setProperty("--klx-hero-key-shift-x", `${side * 4}px`);
  key.style.setProperty("--klx-hero-key-shift-y", `${distance * 2}px`);
}

function resetHeroKeyShadow(event: PointerEvent) {
  const key = event.currentTarget as HTMLElement;
  key.style.removeProperty("--klx-hero-key-shadow-x");
  key.style.removeProperty("--klx-hero-key-shadow-y");
  key.style.removeProperty("--klx-hero-key-shadow-blur");
  key.style.removeProperty("--klx-hero-key-shift-x");
  key.style.removeProperty("--klx-hero-key-shift-y");
}
</script>

<template>
  <Layout>
    <template #home-hero-before>
      <div
        v-if="page.relativePath === 'index.md'"
        class="klx-hero-key"
        aria-hidden="true"
        @pointermove="updateHeroKeyShadow"
        @pointerleave="resetHeroKeyShadow"
      >
        <span>tab</span>
      </div>
    </template>

    <!--
      Rendered between the hero and the feature grid (VitePress's
      `home-hero-after` slot) only on the homepage — a hand-styled preview
      of a real `keylens audit` run against a small, deliberately generic
      demo page, not a static screenshot of any real product.
    -->
    <template #home-hero-after>
      <div
        v-if="page.relativePath === 'index.md'"
        class="keylens-home-sections"
      >
        <div class="keylens-install">
          <div class="keylens-install-copy">
            <p class="keylens-install-eyebrow">Try it in one command</p>
            <p class="keylens-install-title">
              Install Keylens where your tests already live.
            </p>
          </div>
          <CopyCommand :command="installCommand" label="install command" />
          <a
            class="keylens-install-link"
            :href="withBase('/guide/getting-started')"
            >Read the guide <span aria-hidden="true">→</span></a
          >
        </div>

        <section class="keylens-demo">
          <div class="keylens-demo-inner">
            <p class="keylens-demo-eyebrow">See it in action</p>
            <h2 class="keylens-demo-heading">
              Tab through it. See exactly what breaks.
            </h2>
            <p class="keylens-demo-sub">
              Keylens drives a real browser, presses Tab, and renders the actual
              focus path — not a static markup check.
            </p>

            <div class="keylens-demo-grid">
              <div class="keylens-window keylens-terminal">
                <div class="keylens-window-bar">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                  <span class="keylens-window-title"
                    >npx @progress/keylens audit</span
                  >
                </div>
                <pre
                  class="keylens-terminal-body"
                ><code><span class="t-prompt">$ </span><span class="t-cmd">npx @progress/keylens audit sample-interface-url</span>
<span class="t-dim">Crawling tab order in a real browser…</span>

<span class="t-ok">✓</span> keyboard-trap
<span class="t-fail">✗</span> unreachable-elements        <span class="t-badge">1 issue</span>
<span class="t-ok">✓</span> focus-order-mismatch
<span class="t-ok">✓</span> tabindex-abuse
<span class="t-fail">✗</span> missing-focus-indicator     <span class="t-badge">3 issues</span>
<span class="t-fail">✗</span> skip-link                   <span class="t-badge">1 issue</span>
<span class="t-ok">✓</span> focus-not-obscured
<span class="t-ok">✓</span> focus-after-interaction
<span class="t-ok">✓</span> roving-tabindex-broken

<span class="t-dim">────────────────────────────────</span>
<span class="t-result">2 errors, 1 warning</span> <span class="t-dim">·</span> <span class="t-score">score 89/100</span></code></pre>
              </div>

              <div class="keylens-window keylens-browser">
                <div class="keylens-window-bar">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                  <span class="keylens-address-pill"
                    >focus order · 23 stops</span
                  >
                </div>
                <img
                  class="keylens-browser-img"
                  :src="withBase('/demo-focus-map.png')"
                  alt="Numbered markers tracing the Tab order across a small generic sample page, with three markers highlighted in red where the focus indicator is invisible and one interactive control skipped entirely because it's unreachable by keyboard."
                  width="1036"
                  height="856"
                  loading="lazy"
                />
              </div>
            </div>

            <p class="keylens-demo-footnote">
              <a :href="withBase('/demo-cli-output.txt')"
                >View the full CLI output</a
              >
            </p>
          </div>
        </section>
      </div>
    </template>

    <!--
      VitePress's client router falls back to a generic "PAGE NOT FOUND"
      component for any unmatched path (a known limitation: a plain
      docs/404.md is only ever shown for the literal /404 route, not for
      real broken links). Overriding the `not-found` slot is the documented
      way to brand the page every visitor with a dead link actually sees.
    -->
    <template #not-found>
      <div class="keylens-not-found">
        <p class="keylens-not-found-code">404</p>
        <h1>This page tabbed off the edge of the map</h1>
        <p>
          Whatever brought you here doesn't exist. Here's where you probably
          meant to go:
        </p>
        <ul>
          <li>
            <a :href="withBase('/guide/getting-started')">Getting started</a>
          </li>
          <li><a :href="withBase('/rules/')">Rules overview</a></li>
          <li><a :href="withBase('/guide/cli')">CLI reference</a></li>
          <li><a :href="withBase('/')">Home</a></li>
        </ul>
      </div>
    </template>
  </Layout>
</template>

<style scoped>
/* Homepage action and proof sections */
.keylens-home-sections {
  width: 100%;
}

.keylens-install {
  display: flex;
  align-items: center;
  gap: 20px;
  max-width: 1152px;
  margin: 8px auto 0;
  padding: 16px 20px;
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.keylens-install-copy {
  flex: 1;
}

.keylens-install-eyebrow {
  margin: 0 0 3px;
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.keylens-install-title {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 600;
}

.keylens-install-link {
  flex-shrink: 0;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.keylens-install-link:hover {
  text-decoration: underline;
}

/* Homepage "See it in action" demo — a self-contained themed band that
   breaks out of VitePress's centered home-page container on both sides. */
.keylens-demo {
  margin: 48px calc(50% - 50vw) 64px;
  padding: 72px 24px;
  background:
    repeating-linear-gradient(
      135deg,
      var(--klx-stripe) 0px,
      var(--klx-stripe) 1px,
      transparent 1px,
      transparent 14px
    ),
    linear-gradient(180deg, var(--klx-bg-1) 0%, var(--klx-bg-2) 100%);
  transition: background 0.25s;
}

.keylens-demo-inner {
  max-width: 1152px;
  margin: 0 auto;
}

.keylens-demo-eyebrow {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--klx-eyebrow);
  text-align: center;
}

.keylens-demo-heading {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--klx-heading);
  text-align: center;
  border-top: none;
}

.keylens-demo-sub {
  max-width: 560px;
  margin: 0 auto 40px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--klx-sub);
  text-align: center;
}

.keylens-demo-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: stretch;
}

.keylens-window {
  border-radius: 12px;
  overflow: hidden;
  background: var(--klx-window-bg);
  border: 1px solid var(--klx-window-border);
  box-shadow: var(--klx-window-shadow);
  display: flex;
  flex-direction: column;
  transition:
    background 0.25s,
    border-color 0.25s;
}

.keylens-window-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--klx-bar-bg);
  border-bottom: 1px solid var(--klx-bar-border);
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-red {
  background: #ff5f56;
}

.dot-yellow {
  background: #ffbd2e;
}

.dot-green {
  background: #27c93f;
}

.keylens-window-title {
  margin-left: 8px;
  font-size: 12px;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  color: var(--klx-dim);
}

.keylens-address-pill {
  margin-left: 8px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--klx-pill-bg);
  font-size: 11px;
  color: var(--klx-dim);
}

.keylens-terminal-body {
  flex: 1;
  margin: 0;
  padding: 20px 22px;
  font-size: 13px;
  line-height: 1.85;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  color: var(--klx-body);
  overflow-x: auto;
  white-space: pre;
}

.t-prompt {
  color: var(--klx-dim);
}

.t-cmd {
  color: var(--klx-heading);
  font-weight: 600;
}

.t-dim {
  color: var(--klx-dim);
}

.t-ok {
  color: var(--klx-ok);
}

.t-fail {
  color: var(--klx-fail);
}

.t-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--klx-badge-bg);
  color: var(--klx-badge-text);
  font-size: 11px;
}

.t-result {
  color: var(--klx-heading);
  font-weight: 600;
}

.t-score {
  color: var(--klx-score);
  font-weight: 600;
}

.keylens-browser {
  justify-content: flex-start;
}

.keylens-browser-img {
  display: block;
  width: 100%;
  height: auto;
}

.keylens-demo-footnote {
  margin: 24px 0 0;
  text-align: center;
  font-size: 13px;
}

.keylens-demo-footnote a {
  color: var(--klx-eyebrow);
}

@media (max-width: 1200px) {
  .keylens-install {
    margin-right: 24px;
    margin-left: 24px;
  }

  .keylens-demo-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .keylens-install {
    display: block;
    margin-top: 0;
    padding: 16px;
  }
}

.keylens-not-found {
  max-width: 480px;
  margin: 0 auto;
  padding: 96px 24px;
  text-align: center;
}

.keylens-not-found-code {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-brand-1);
  margin: 0 0 16px;
}

.keylens-not-found h1 {
  font-size: 20px;
  margin: 0 0 12px;
}

.keylens-not-found ul {
  list-style: none;
  padding: 0;
  margin: 24px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
