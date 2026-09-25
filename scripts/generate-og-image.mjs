#!/usr/bin/env node
/**
 * Renders docs/public/og-image.png (1200x630) from an inline HTML template
 * using the Playwright Chromium already installed for the crawler/tests.
 * Re-run this script (`node scripts/generate-og-image.mjs`) whenever the
 * brand colors, logo, or tagline change; the output is a committed static
 * asset, not regenerated on every docs:build.
 */
import { chromium } from "playwright";
import { resolve } from "node:path";

const width = 1200;
const height = 630;

const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${width}px;
        height: ${height}px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: linear-gradient(135deg, #151950 0%, #20256c 55%, #2b2bb2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 88px 96px;
        position: relative;
        overflow: hidden;
      }
      .glow {
        position: absolute;
        top: -180px;
        right: -180px;
        width: 520px;
        height: 520px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(152, 185, 254, 0.35), transparent 70%);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 40px;
      }
      .logo {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: #5b8def;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .brand-name {
        font-size: 32px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.02em;
      }
      h1 {
        font-size: 64px;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.12;
        letter-spacing: -0.02em;
        max-width: 920px;
      }
      p {
        margin-top: 28px;
        font-size: 28px;
        color: #c1d5fe;
        max-width: 820px;
        line-height: 1.45;
      }
      .pill {
        margin-top: 44px;
        display: inline-flex;
        align-self: flex-start;
        padding: 10px 22px;
        border-radius: 999px;
        background: rgba(152, 185, 254, 0.14);
        border: 1px solid rgba(152, 185, 254, 0.4);
        color: #98b9fe;
        font-size: 22px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="glow"></div>
      <div class="brand">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 16h4l3-6 5 12 3-6h4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="16" cy="7" r="2.5" fill="#fff" opacity="0.8"/>
          </svg>
        </div>
        <div class="brand-name">Keylens</div>
      </div>
      <h1>Press Tab. Record what actually happens.</h1>
      <p>Real-browser keyboard navigation testing for CLI, CI, and programmatic audits.</p>
      <div class="pill">⌨️ Keyboard traps · focus order · skip links · CI exit codes</div>
    </div>
  </body>
</html>
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.setContent(html);
const outPath = resolve(import.meta.dirname, "../docs/public/og-image.png");
await page.screenshot({ path: outPath });
await browser.close();

console.log(`Wrote ${outPath}`);
