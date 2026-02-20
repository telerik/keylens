import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { audit } from "@/index.js";
import { DEFAULT_CONFIG } from "@/utils/config.js";
import type { KeylensConfig } from "@/types/index.js";

function serveFixture(fixtureName: string): Promise<{
  server: Server;
  url: string;
}> {
  const html = readFileSync(
    resolve(__dirname, `../fixtures/${fixtureName}`),
    "utf-8",
  );
  return new Promise((resolvePromise) => {
    const server = createServer((_req, res) => {
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

function makeConfig(overrides: Partial<KeylensConfig> = {}): KeylensConfig {
  return {
    ...DEFAULT_CONFIG,
    reporters: [], // Don't write files during tests
    ai: { ...DEFAULT_CONFIG.ai, enabled: false },
    maxTabs: 100,
    waitAfterLoad: 500,
    ...overrides,
  };
}

describe("Integration: audit pipeline", () => {
  let testPageServer: Server;
  let testPageUrl: string;
  let cleanPageServer: Server;
  let cleanPageUrl: string;

  beforeAll(async () => {
    const testPage = await serveFixture("test-page.html");
    testPageServer = testPage.server;
    testPageUrl = testPage.url;

    const cleanPage = await serveFixture("clean-page.html");
    cleanPageServer = cleanPage.server;
    cleanPageUrl = cleanPage.url;
  });

  afterAll(() => {
    testPageServer?.close();
    cleanPageServer?.close();
  });

  it("should complete an audit without crashing", async () => {
    const report = await audit(testPageUrl, makeConfig());

    expect(report).toBeDefined();
    expect(report.url).toBe(testPageUrl);
    expect(report.focusSequence).toBeDefined();
    expect(report.focusSequence!.length).toBeGreaterThan(0);
    expect(report.crawl.duration).toBeGreaterThan(0);
  });

  it("should detect tabindex abuse", async () => {
    const report = await audit(testPageUrl, makeConfig());

    const tabindexRule = report.rules.find(
      (r) => r.ruleId === "tabindex-abuse",
    );
    expect(tabindexRule).toBeDefined();
    expect(tabindexRule!.passed).toBe(false);
    expect(tabindexRule!.violations.length).toBeGreaterThan(0);
  });

  it("should detect missing skip link", async () => {
    const report = await audit(testPageUrl, makeConfig());

    const skipLinkRule = report.rules.find((r) => r.ruleId === "skip-link");
    expect(skipLinkRule).toBeDefined();
    expect(skipLinkRule!.passed).toBe(false);
  });

  it("should detect missing focus indicators", async () => {
    const report = await audit(testPageUrl, makeConfig());

    const focusRule = report.rules.find(
      (r) => r.ruleId === "missing-focus-indicator",
    );
    expect(focusRule).toBeDefined();
    expect(focusRule!.passed).toBe(false);
  });

  it("should have errors in summary", async () => {
    const report = await audit(testPageUrl, makeConfig());

    expect(
      report.summary.totalErrors + report.summary.totalWarnings,
    ).toBeGreaterThan(0);
    expect(report.summary.failed).toBeGreaterThan(0);
  });

  it("should include pageScreenshot as non-empty base64 string", async () => {
    const report = await audit(testPageUrl, makeConfig());

    expect(report.pageScreenshot).toBeDefined();
    expect(report.pageScreenshot!.length).toBeGreaterThan(100);
  });

  it("should report correct totalInteractiveElements count", async () => {
    const report = await audit(testPageUrl, makeConfig());

    // test-page has: 5 nav links, 1 no-outline link, 2 tabindex buttons,
    // 1 trap input, 1 button, 1 link, 1 input, 1 select = at least 10+
    expect(report.crawl.totalInteractiveElements).toBeGreaterThanOrEqual(10);
  });

  it("should report cycleCompleted as true on clean page", async () => {
    const report = await audit(cleanPageUrl, makeConfig());

    expect(report.crawl.cycleCompleted).toBe(true);
  });

  it("should detect unreachable elements on test page", async () => {
    const report = await audit(testPageUrl, makeConfig());

    const unreachableRule = report.rules.find(
      (r) => r.ruleId === "unreachable-elements",
    );
    expect(unreachableRule).toBeDefined();
    // The onclick div is interactive but not keyboard-focusable
    expect(unreachableRule!.violations.length).toBeGreaterThan(0);
  });

  it("should pass focus-not-obscured on clean page", async () => {
    const report = await audit(cleanPageUrl, makeConfig());

    const obscuredRule = report.rules.find(
      (r) => r.ruleId === "focus-not-obscured",
    );
    expect(obscuredRule).toBeDefined();
    expect(obscuredRule!.passed).toBe(true);
  });

  it("should pass focus-not-obscured on test page", async () => {
    const report = await audit(testPageUrl, makeConfig());

    const obscuredRule = report.rules.find(
      (r) => r.ruleId === "focus-not-obscured",
    );
    expect(obscuredRule).toBeDefined();
    expect(obscuredRule!.passed).toBe(true);
  });

  it("should pass all rules on a clean page", async () => {
    const report = await audit(cleanPageUrl, makeConfig());

    expect(report).toBeDefined();
    expect(report.focusSequence!.length).toBeGreaterThan(0);

    // Skip link should be detected
    const skipLinkRule = report.rules.find((r) => r.ruleId === "skip-link");
    expect(skipLinkRule).toBeDefined();
    expect(skipLinkRule!.passed).toBe(true);

    // No tabindex abuse
    const tabindexRule = report.rules.find(
      (r) => r.ruleId === "tabindex-abuse",
    );
    expect(tabindexRule).toBeDefined();
    expect(tabindexRule!.passed).toBe(true);

    // No keyboard traps
    const trapRule = report.rules.find((r) => r.ruleId === "keyboard-trap");
    expect(trapRule).toBeDefined();
    expect(trapRule!.passed).toBe(true);
  });
});
