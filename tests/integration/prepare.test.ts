import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { preparePage } from "@/crawler/prepare.js";
import { crawlPage } from "@/crawler/index.js";
import { DEFAULT_CONFIG, normalizeConfig } from "@/utils/config.js";
import type { KeylensConfig } from "@/types/index.js";

function serveFixture(): Promise<{ server: Server; url: string }> {
  const html = readFileSync(
    resolve(__dirname, "../fixtures/consent-banner-page.html"),
    "utf-8",
  );
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolvePromise({ server, url: `http://localhost:${port}` });
    });
  });
}

function withPrepare(
  overrides: Partial<KeylensConfig["prepare"]>,
): KeylensConfig {
  return normalizeConfig({ prepare: overrides });
}

describe("Integration: prepare phase (consent banner dismissal)", () => {
  let browser: Browser;
  let page: Page;
  let server: Server;
  let url: string;

  beforeAll(async () => {
    const fixture = await serveFixture();
    server = fixture.server;
    url = fixture.url;
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it("dismisses a known OneTrust banner via the reject action by default", async () => {
    page = await browser.newPage();
    await page.goto(url);

    const result = await preparePage(page, DEFAULT_CONFIG, undefined, url);

    expect(result.attempted).toBe(true);
    expect(result.dismissals).toHaveLength(1);
    expect(result.dismissals[0]).toMatchObject({
      provider: "OneTrust",
      action: "reject",
      verified: true,
    });
    expect(await page.locator("#onetrust-banner-sdk").isHidden()).toBe(true);

    await page.close();
  });

  it("prefers accept when consentPreference is 'accept'", async () => {
    page = await browser.newPage();
    await page.goto(url);

    const config = withPrepare({ consentPreference: "accept" });
    const result = await preparePage(page, config, undefined, url);

    expect(result.dismissals[0]).toMatchObject({
      provider: "OneTrust",
      action: "accept",
      verified: true,
    });

    await page.close();
  });

  it("removes the banner from the recorded tab-crawl focus sequence", async () => {
    const crawlResult = await crawlPage(url, {
      ...DEFAULT_CONFIG,
      maxTabs: 15,
    });

    const selectors = crawlResult.focusSequence.map((el) => el.selector);
    expect(selectors).not.toContain("#onetrust-reject-all-handler");
    expect(selectors).not.toContain("#onetrust-accept-btn-handler");
    expect(crawlResult.prepare?.dismissals).toHaveLength(1);
    expect(crawlResult.prepare?.dismissals[0].provider).toBe("OneTrust");
  });

  it("keeps the banner reachable when dismissOverlays is disabled (--keep-overlays)", async () => {
    const crawlResult = await crawlPage(url, {
      ...DEFAULT_CONFIG,
      maxTabs: 15,
      prepare: {
        ...DEFAULT_CONFIG.prepare,
        dismissOverlays: false,
        expandScrollContainers: false,
      },
    });

    const selectors = crawlResult.focusSequence.map((el) => el.selector);
    expect(selectors).toContain("#onetrust-reject-all-handler");
    expect(crawlResult.prepare?.attempted).toBe(false);
  });

  it("falls back to the generic heuristic when no preset matches", async () => {
    page = await browser.newPage();
    await page.goto(`${url}?heuristic=1`);

    const result = await preparePage(page, DEFAULT_CONFIG, undefined, url);

    expect(result.dismissals).toHaveLength(1);
    expect(result.dismissals[0]).toMatchObject({
      provider: "heuristic",
      action: "reject",
      verified: true,
    });
    expect(await page.locator("#generic-banner").isHidden()).toBe(true);

    await page.close();
  });

  it("clicks custom dismiss selectors even without a matching preset", async () => {
    page = await browser.newPage();
    await page.goto(`${url}?heuristic=1`);

    const config = withPrepare({
      dismissOverlays: false,
      dismissSelectors: ["#generic-accept"],
    });
    const result = await preparePage(page, config, undefined, url);

    expect(result.dismissals).toHaveLength(1);
    expect(result.dismissals[0]).toMatchObject({
      provider: "custom",
      action: "custom",
      selector: "#generic-accept",
      verified: true,
    });

    await page.close();
  });

  it("runs generic prepare steps (click, press, wait, waitFor) in order", async () => {
    page = await browser.newPage();
    await page.goto(url);

    const config = withPrepare({
      dismissOverlays: false,
      steps: [
        { type: "click", selector: "#onetrust-reject-all-handler" },
        { type: "wait", ms: 10 },
        { type: "waitFor", selector: "#button-1" },
        { type: "press", key: "Tab" },
      ],
    });
    const result = await preparePage(page, config, undefined, url);

    expect(result.attempted).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(await page.locator("#onetrust-banner-sdk").isHidden()).toBe(true);

    await page.close();
  });

  it("records an optional click step as a no-op warning-free miss when the selector is absent", async () => {
    page = await browser.newPage();
    await page.goto(url);

    const config = withPrepare({
      dismissOverlays: false,
      steps: [{ type: "click", selector: "#does-not-exist", optional: true }],
    });
    const result = await preparePage(page, config, undefined, url);

    expect(result.warnings).toHaveLength(0);

    await page.close();
  });

  it("does nothing and reports attempted: false when there is no prepare work configured", async () => {
    page = await browser.newPage();
    await page.goto(url);

    const config = withPrepare({
      dismissOverlays: false,
      expandScrollContainers: false,
    });
    const result = await preparePage(page, config, undefined, url);

    expect(result.attempted).toBe(false);
    expect(result.dismissals).toHaveLength(0);
    expect(await page.locator("#onetrust-banner-sdk").isVisible()).toBe(true);

    await page.close();
  });
});
