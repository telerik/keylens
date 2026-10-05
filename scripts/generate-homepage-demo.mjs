#!/usr/bin/env node
/**
 * Runs a real `keylens audit` against a purpose-built demo fixture
 * (scripts/demo/homepage-demo-page.html — a small, deliberately generic page
 * with a nav, hero, three feature panels, a subscribe form, and footer, plus
 * three intentional issues: an unreachable `role="button"` icon, feature
 * CTA links with no visible focus indicator, and no skip link) and captures
 * two artifacts for the docs homepage:
 *
 *  - docs/public/demo-cli-output.txt: the plain-text CLI report
 *  - docs/public/demo-focus-map.png: a screenshot of the HTML report's
 *    focus-order overlay (numbered markers + connecting lines), cropped to
 *    a representative top slice rather than the full (very tall) page
 *
 * Run with `npm run docs:demo` after `npm run build`. Re-run whenever the
 * fixture, CLI report format, or HTML focus-map rendering changes.
 */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { audit, renderAuditReport } from "../dist/index.js";

const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(root, "scripts/demo/homepage-demo-page.html");
const outDir = "/tmp/keylens-homepage-demo";
const publicDir = resolve(root, "docs/public");

const fixtureHtml = await readFile(fixturePath, "utf-8");

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(fixtureHtml);
});
await new Promise((resolvePort) => server.listen(0, resolvePort));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;

const report = await audit(url, {
  profile: "balanced",
  capture: { page: "full" },
  appendTimestamp: false,
});

await renderAuditReport(report, ["html"], outDir);

// Re-run the CLI reporter through a plain (non-TTY) pipe so ANSI color codes
// are stripped — chalk auto-disables color when stdout isn't a terminal.
const cliOutput = await new Promise((resolveOutput, reject) => {
  const child = spawn(
    process.execPath,
    [resolve(root, "dist/cli/index.js"), "audit", url, "--profile", "balanced"],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  let out = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  child.on("close", () => resolveOutput(out));
  child.on("error", reject);
});

await writeFile(
  resolve(publicDir, "demo-cli-output.txt"),
  cliOutput.trimEnd() + "\n",
);

// Screenshot the HTML report's focus-map overlay, cropped to a
// representative top slice (the full page is much taller than the demo
// card is wide, so the full-height overlay doesn't read well at a glance).
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1100, height: 1400 },
});
await page.goto(`file://${resolve(outDir, "keylens-report.html")}`);
const overlay = page.locator(".focus-map").first();
const box = await overlay.boundingBox();
await page.screenshot({
  path: resolve(publicDir, "demo-focus-map.png"),
  clip: {
    x: box.x,
    y: box.y,
    width: box.width,
    height: Math.min(box.height, 900),
  },
});
await browser.close();
server.close();

console.log("Wrote docs/public/demo-cli-output.txt and demo-focus-map.png");
