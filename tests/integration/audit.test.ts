import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import { access, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  audit,
  AuditAbortedError,
  AuditTimeoutError,
  renderAuditReport,
} from "@/index.js";
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
  let interactionsPageServer: Server;
  let interactionsPageUrl: string;

  beforeAll(async () => {
    const testPage = await serveFixture("test-page.html");
    testPageServer = testPage.server;
    testPageUrl = testPage.url;

    const cleanPage = await serveFixture("clean-page.html");
    cleanPageServer = cleanPage.server;
    cleanPageUrl = cleanPage.url;

    const interactionsPage = await serveFixture("interactions-page.html");
    interactionsPageServer = interactionsPage.server;
    interactionsPageUrl = interactionsPage.url;
  });

  afterAll(() => {
    testPageServer?.close();
    cleanPageServer?.close();
    interactionsPageServer?.close();
  });

  it("should complete an audit without crashing", async () => {
    const report = await audit(testPageUrl, makeConfig());

    expect(report).toBeDefined();
    expect(report.url).toBe(testPageUrl);
    expect(report.focusSequence).toBeDefined();
    expect(report.focusSequence!.length).toBeGreaterThan(0);
    expect(report.crawl.duration).toBeGreaterThan(0);
  });

  it("aborts promptly and removes process cleanup listeners", async () => {
    const controller = new AbortController();
    const initialSigintListeners = process.listenerCount("SIGINT");
    const initialSigtermListeners = process.listenerCount("SIGTERM");
    const events: string[] = [];

    const pending = audit(testPageUrl, {
      ...makeConfig({ waitAfterLoad: 10_000 }),
      signal: controller.signal,
      onEvent: (event) => events.push(`${event.type}:${event.phase}`),
    });
    setTimeout(() => controller.abort(), 50);

    await expect(pending).rejects.toBeInstanceOf(AuditAbortedError);
    const eventsAtRejection = [...events];
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));

    expect(events).toEqual(eventsAtRejection);
    expect(process.listenerCount("SIGINT")).toBe(initialSigintListeners);
    expect(process.listenerCount("SIGTERM")).toBe(initialSigtermListeners);
  });

  it("enforces total wall-time without leaving cleanup listeners", async () => {
    const initialSigintListeners = process.listenerCount("SIGINT");

    const pending = audit(testPageUrl, {
      ...makeConfig({ waitAfterLoad: 10_000 }),
      timeouts: { total: 50 },
    });

    await expect(pending).rejects.toBeInstanceOf(AuditTimeoutError);
    await expect(pending).rejects.toMatchObject({
      phase: "crawl",
      details: {
        timeoutMs: 50,
        timeoutKind: "total",
      },
    });

    expect(process.listenerCount("SIGINT")).toBe(initialSigintListeners);
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

  it("should keep nonvisual audits free of screenshot assets", async () => {
    const report = await audit(testPageUrl, makeConfig());

    expect(report.pageScreenshotAssetId).toBeUndefined();
    expect(report.assets).toEqual([]);
    expect(report.crawl.capture.byteLength).toBe(0);
  });

  it("should capture a bounded page screenshot as a separate asset", async () => {
    const report = await audit(
      testPageUrl,
      makeConfig({
        capture: {
          ...DEFAULT_CONFIG.capture,
          page: "full",
        },
      }),
    );

    expect(report.pageScreenshotAssetId).toBe("page-screenshot");
    expect(report.assets[0]).toEqual(
      expect.objectContaining({
        type: "page-screenshot",
        byteLength: expect.any(Number),
        storage: expect.objectContaining({ kind: "inline" }),
      }),
    );
    expect(report.crawl.capture.byteLength).toBeGreaterThan(100);
  });

  it("should skip page capture before rasterization when dimensions exceed limits", async () => {
    const report = await audit(
      cleanPageUrl,
      makeConfig({
        capture: {
          page: "full",
          elements: false,
          limits: {
            ...DEFAULT_CONFIG.capture.limits,
            maxDimension: 1,
          },
        },
      }),
    );

    expect(report.assets).toEqual([]);
    expect(report.crawl.capture).toEqual(
      expect.objectContaining({
        attempted: 1,
        captured: 0,
        skipped: 1,
        byteLength: 0,
      }),
    );
  });

  it("records bounded interaction outcomes without activating unsafe controls", async () => {
    const report = await audit(
      interactionsPageUrl,
      makeConfig({
        maxTabs: 20,
        waitAfterLoad: 10,
        tabDelay: 10,
        interactions: {
          ...DEFAULT_CONFIG.interactions,
          enabled: true,
          maxCases: 10,
          timeout: 1_000,
          exclude: [".excluded"],
        },
      }),
    );

    expect(report.crawl.interactions).toEqual(
      expect.objectContaining({
        failed: expect.any(Number),
        skipped: expect.any(Number),
        errors: expect.any(Number),
      }),
    );
    const results = report.focusSequence
      ? report.rules.find(
          (result) => result.ruleId === "focus-after-interaction",
        )
      : undefined;
    expect(results?.status).toBe("failed");
    expect(
      results?.violations.some((violation) =>
        violation.message.includes("#lose"),
      ),
    ).toBe(true);

    expect(report.interactionResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: expect.objectContaining({ selector: "#preserve" }),
          status: "passed",
          reason: "focus-preserved",
        }),
        expect.objectContaining({
          element: expect.objectContaining({ selector: "#move" }),
          status: "passed",
          reason: "focus-moved",
        }),
        expect.objectContaining({
          element: expect.objectContaining({ selector: "#managed-focus" }),
          status: "passed",
          reason: "focus-moved",
        }),
        expect.objectContaining({
          element: expect.objectContaining({ selector: "#lose" }),
          status: "failed",
          reason: "focus-lost",
        }),
        expect.objectContaining({
          element: expect.objectContaining({ selector: "#remove-trigger" }),
          status: "failed",
          reason: "focus-lost",
        }),
        expect.objectContaining({
          element: expect.objectContaining({ selector: "#navigate" }),
          status: "skipped",
          reason: "navigation-blocked",
        }),
        expect.objectContaining({
          element: expect.objectContaining({ selector: "#delete-account" }),
          status: "skipped",
          reason: "destructive",
        }),
        expect.objectContaining({
          element: expect.objectContaining({
            accessibleName: "Excluded control",
          }),
          status: "skipped",
          reason: "excluded",
        }),
      ]),
    );
  });

  it("caps attempted interaction cases and reports remaining cases as skipped", async () => {
    const { crawlOnly } = await import("@/index.js");
    const crawl = await crawlOnly(interactionsPageUrl, {
      ...makeConfig({ maxTabs: 20, waitAfterLoad: 10, tabDelay: 10 }),
      interactions: {
        ...DEFAULT_CONFIG.interactions,
        enabled: true,
        maxCases: 1,
        timeout: 1_000,
      },
    });

    expect(crawl.interactionSummary?.attempted).toBe(1);
    expect(crawl.interactionResults).toContainEqual(
      expect.objectContaining({
        status: "skipped",
        reason: "limit-reached",
      }),
    );
  });

  it("supports bounded Enter and Space activation cases", async () => {
    const { crawlOnly } = await import("@/index.js");
    const crawl = await crawlOnly(interactionsPageUrl, {
      ...makeConfig({ maxTabs: 20, waitAfterLoad: 10, tabDelay: 10 }),
      interactions: {
        ...DEFAULT_CONFIG.interactions,
        enabled: true,
        maxCases: 2,
        timeout: 1_000,
        include: ["#preserve"],
        actions: ["enter", "space"],
      },
    });

    expect(crawl.interactionResults).toEqual([
      expect.objectContaining({
        action: "enter",
        status: "passed",
        reason: "focus-preserved",
      }),
      expect.objectContaining({
        action: "space",
        status: "passed",
        reason: "focus-preserved",
      }),
    ]);
  });

  it("records timed-out activation operations as errors", async () => {
    const { crawlOnly } = await import("@/index.js");
    const crawl = await crawlOnly(interactionsPageUrl, {
      ...makeConfig({ maxTabs: 20, waitAfterLoad: 10, tabDelay: 10 }),
      interactions: {
        ...DEFAULT_CONFIG.interactions,
        enabled: true,
        maxCases: 1,
        timeout: 50,
        include: ["#blocked-action"],
      },
    });

    expect(crawl.interactionResults).toEqual([
      expect.objectContaining({
        element: expect.objectContaining({ accessibleName: "Blocked action" }),
        status: "error",
        reason: "action-failed",
      }),
    ]);
  });

  it("allows navigation when interaction policy permits it", async () => {
    const { crawlOnly } = await import("@/index.js");
    const crawl = await crawlOnly(interactionsPageUrl, {
      ...makeConfig({ maxTabs: 20, waitAfterLoad: 10, tabDelay: 10 }),
      interactions: {
        ...DEFAULT_CONFIG.interactions,
        enabled: true,
        maxCases: 1,
        timeout: 1_000,
        include: ["#navigate"],
        navigation: "allow",
      },
    });

    expect(crawl.interactionResults).toEqual([
      expect.not.objectContaining({ reason: "navigation-blocked" }),
    ]);
    expect(crawl.interactionSummary?.attempted).toBe(1);
  });

  it("keeps page state when interaction isolation is disabled", async () => {
    const { crawlOnly } = await import("@/index.js");
    const crawl = await crawlOnly(interactionsPageUrl, {
      ...makeConfig({ maxTabs: 20, waitAfterLoad: 10, tabDelay: 10 }),
      interactions: {
        ...DEFAULT_CONFIG.interactions,
        enabled: true,
        maxCases: 1,
        timeout: 1_000,
        include: ["#stale"],
        isolation: "none",
      },
    });

    expect(crawl.interactionResults).toEqual([
      expect.objectContaining({
        element: expect.objectContaining({
          accessibleName: "Removed after the initial crawl",
        }),
        status: "passed",
        reason: "focus-preserved",
      }),
    ]);
  });

  it("should only write configured reporters when rendering is explicit", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "keylens-report-"));
    const reportPath = join(outputDir, "keylens-report.json");

    try {
      const report = await audit(
        testPageUrl,
        makeConfig({ reporters: ["json"], outputDir }),
      );

      await expect(access(reportPath)).rejects.toThrow();
      await renderAuditReport(report, ["json"], outputDir);
      await expect(access(reportPath)).resolves.toBeUndefined();
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
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
