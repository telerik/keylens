import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CrawlResult, KeylensConfig, RuleResult } from "@/types/index.js";
import {
  makeCrawlResult,
  makeFocusedElement,
  makeInteractiveElement,
  makeAuditReport,
  makeInlineAsset,
} from "@tests/helpers/factories.js";
import { DEFAULT_CONFIG } from "@/utils/config.js";

// Mock dependencies
vi.mock("@/crawler/index.js", () => ({
  crawlPage: vi.fn(),
  launchAuditBrowser: vi.fn(),
  markReachedElements: vi.fn(),
}));

vi.mock("@/rules/index.js", () => ({
  runRules: vi.fn(),
}));

vi.mock("@/reporters/index.js", () => ({
  runReporters: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/logger.js", () => ({
  withLogLevel: vi.fn(
    async (_level: string, operation: () => Promise<unknown>) => operation(),
  ),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    rule: vi.fn(),
    divider: vi.fn(),
    blank: vi.fn(),
  },
}));

import { crawlPage, launchAuditBrowser } from "@/crawler/index.js";
import { runRules } from "@/rules/index.js";
import { runReporters } from "@/reporters/index.js";
import { withLogLevel } from "@/utils/logger.js";

const mockCrawlPage = vi.mocked(crawlPage);
const mockLaunchAuditBrowser = vi.mocked(launchAuditBrowser);
const mockSharedBrowserClose = vi.fn().mockResolvedValue(undefined);
const mockRunRules = vi.mocked(runRules);
const mockRunReporters = vi.mocked(runReporters);
const mockWithLogLevel = vi.mocked(withLogLevel);

beforeEach(() => {
  vi.clearAllMocks();
  mockSharedBrowserClose.mockClear();
  mockLaunchAuditBrowser.mockResolvedValue({
    close: mockSharedBrowserClose,
  } as never);
});

describe("audit", () => {
  async function getAudit() {
    const mod = await import("@/index.js");
    return mod.audit;
  }

  const defaultCrawlResult: CrawlResult = makeCrawlResult({
    focusSequence: [
      makeFocusedElement({ tabIndex: 1, selector: "button.a" }),
      makeFocusedElement({ tabIndex: 2, selector: "button.b" }),
    ],
    interactiveElements: [
      makeInteractiveElement({ selector: "button.a", reached: true }),
      makeInteractiveElement({ selector: "button.b", reached: true }),
      makeInteractiveElement({ selector: "button.c", reached: false }),
    ],
    pageScreenshotAssetId: "page-screenshot",
    assets: [makeInlineAsset("page-screenshot", "base64-screenshot")],
  });

  const defaultRuleResults: RuleResult[] = [
    { ruleId: "rule-1", passed: true, violations: [], duration: 5 },
    {
      ruleId: "rule-2",
      passed: false,
      violations: [
        {
          ruleId: "rule-2",
          ruleName: "Rule 2",
          severity: "error",
          message: "Error found",
          elements: [],
          impact: "High",
        },
        {
          ruleId: "rule-2",
          ruleName: "Rule 2",
          severity: "warning",
          message: "Warning found",
          elements: [],
          impact: "Medium",
        },
      ],
      duration: 10,
    },
  ];

  function setupMocks() {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue(defaultRuleResults);
  }

  it("should call crawlPage with url and config", async () => {
    setupMocks();
    const audit = await getAudit();
    const config: KeylensConfig = { ...DEFAULT_CONFIG };

    await audit("https://example.com", config);

    expect(mockCrawlPage).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining(config),
      expect.any(AbortSignal),
      undefined,
      undefined,
      expect.any(Number),
    );
  });

  it("should call runRules with crawl result and config", async () => {
    setupMocks();
    const audit = await getAudit();
    const config: KeylensConfig = { ...DEFAULT_CONFIG };

    await audit("https://example.com", config);

    expect(mockRunRules).toHaveBeenCalledWith(
      defaultCrawlResult,
      expect.objectContaining(config),
      expect.any(AbortSignal),
      undefined,
      expect.any(Number),
    );
  });

  it("should not run reporters implicitly", async () => {
    setupMocks();
    const audit = await getAudit();
    const config: KeylensConfig = {
      ...DEFAULT_CONFIG,
      reporters: ["cli", "json"],
      outputDir: "./my-output",
    };

    await audit("https://example.com", config);

    expect(mockRunReporters).not.toHaveBeenCalled();
  });

  it("should default programmatic execution to silent logging", async () => {
    setupMocks();
    const audit = await getAudit();

    await audit("https://example.com");

    expect(mockWithLogLevel).toHaveBeenCalledWith(
      "silent",
      expect.any(Function),
    );
  });

  it("should build report with correct crawl summary", async () => {
    setupMocks();
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.crawl.totalFocusableElements).toBe(2);
    expect(report.crawl.totalInteractiveElements).toBe(3);
    expect(report.crawl.unreachedElements).toBe(1);
    expect(report.crawl.cycleCompleted).toBe(true);
  });

  describe("staged audit API", () => {
    const crawlResult = makeCrawlResult({
      focusSequence: [makeFocusedElement()],
      interactiveElements: [makeInteractiveElement({ reached: true })],
      pageScreenshotAssetId: "page-screenshot",
      assets: [makeInlineAsset("page-screenshot", "base64-screenshot")],
    });
    const ruleResults: RuleResult[] = [
      {
        ruleId: "tabindex-abuse",
        passed: false,
        violations: [
          {
            ruleId: "tabindex-abuse",
            ruleName: "Tabindex Abuse",
            severity: "warning",
            message: "Positive tabindex",
            elements: [],
            impact: "Focus order changes",
          },
        ],
        duration: 1,
      },
    ];

    function setupStageMocks() {
      mockCrawlPage.mockResolvedValue(crawlResult);
      mockRunRules.mockResolvedValue(ruleResults);
    }

    it("audit returns deterministic results without reporters", async () => {
      setupStageMocks();
      const audit = await getAudit();

      const report = await audit("https://example.com", {
        viewport: { width: 800 },
        reporters: ["json"],
      });

      expect(report.summary.totalWarnings).toBe(1);
      expect(report.config.viewport).toEqual({ width: 800, height: 720 });
      expect(report.interactiveElements).toEqual(
        crawlResult.interactiveElements,
      );
      expect(report.timings).toEqual(
        expect.objectContaining({
          crawl: crawlResult.crawlDuration,
          rules: expect.any(Number),
          total: expect.any(Number),
        }),
      );
      expect(mockRunReporters).not.toHaveBeenCalled();
    });

    it("aborts a crawl before rules continue", async () => {
      const controller = new AbortController();
      mockCrawlPage.mockImplementation((_url, _config, signal) => {
        return new Promise<CrawlResult>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      });
      const { audit, AuditAbortedError } = await import("@/index.js");

      const pending = audit("https://example.com", {
        signal: controller.signal,
      });
      controller.abort();

      await expect(pending).rejects.toBeInstanceOf(AuditAbortedError);
      expect(mockRunRules).not.toHaveBeenCalled();
    });

    it("enforces the configured crawl timeout", async () => {
      mockCrawlPage.mockImplementation((_url, _config, signal) => {
        return new Promise<CrawlResult>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      });
      const { audit, AuditTimeoutError } = await import("@/index.js");

      const pending = audit("https://example.com", {
        timeouts: { crawl: 10 },
      });

      await expect(pending).rejects.toBeInstanceOf(AuditTimeoutError);
      await expect(pending).rejects.toMatchObject({
        code: "TIMEOUT",
        phase: "crawl",
        details: { timeoutMs: 10, timeoutKind: "phase" },
      });
      expect(mockRunRules).not.toHaveBeenCalled();
    });

    it("enforces the configured rules timeout", async () => {
      mockCrawlPage.mockResolvedValue(crawlResult);
      mockRunRules.mockImplementation((_crawl, _config, signal) => {
        return new Promise<RuleResult[]>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      });
      const { audit, AuditTimeoutError } = await import("@/index.js");

      const pending = audit("https://example.com", {
        timeouts: { rules: 10 },
      });

      await expect(pending).rejects.toBeInstanceOf(AuditTimeoutError);
      await expect(pending).rejects.toMatchObject({
        code: "TIMEOUT",
        phase: "rules",
        details: { timeoutMs: 10, timeoutKind: "phase" },
      });
    });

    it("renderAuditReport performs output only when called explicitly", async () => {
      const { renderAuditReport } = await import("@/index.js");
      const report = makeAuditReport();

      await renderAuditReport(report, ["json"], "./output", "warn");

      expect(mockRunReporters).toHaveBeenCalledWith(
        report,
        ["json"],
        "./output",
        expect.any(AbortSignal),
      );
      expect(mockWithLogLevel).toHaveBeenCalledWith(
        "warn",
        expect.any(Function),
      );
    });
  });

  it("should calculate correct violation summary", async () => {
    setupMocks();
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.summary.totalErrors).toBe(1);
    expect(report.summary.totalWarnings).toBe(1);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
  });

  it("separates rule evaluator errors from accessibility failures", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue([
      {
        ruleId: "missing-focus-indicator",
        passed: false,
        status: "error",
        violations: [],
        duration: 1,
        error: {
          code: "RULE_ERROR",
          message: "screenshot comparison failed",
        },
      },
    ]);
    const audit = await getAudit();

    const report = await audit("https://example.com");

    expect(report.summary).toMatchObject({
      totalErrors: 0,
      passed: 0,
      failed: 0,
      errors: 1,
      scoreComplete: false,
    });
  });

  it("should extract screenshots into report assets", async () => {
    setupMocks();
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.focusSequence).toHaveLength(2);
    expect(report.pageScreenshotAssetId).toBe("page-screenshot");
    expect(report.assets).toContainEqual(
      expect.objectContaining({
        id: "page-screenshot",
        type: "page-screenshot",
        storage: {
          kind: "inline",
          data: "base64-screenshot",
          encoding: "base64",
        },
      }),
    );
  });

  it("should include interaction execution counts in the crawl summary", async () => {
    mockCrawlPage.mockResolvedValue({
      ...defaultCrawlResult,
      interactionResults: [
        {
          element: {
            selector: "button.a",
            tagName: "button",
            role: "button",
            accessibleName: "A",
          },
          action: "click",
          focusAfter: null,
          status: "failed",
          reason: "focus-lost",
          duration: 5,
        },
      ],
      interactionSummary: {
        total: 1,
        attempted: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        errors: 0,
      },
    });
    mockRunRules.mockResolvedValue(defaultRuleResults);
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.crawl.interactions).toEqual(
      expect.objectContaining({ attempted: 1, failed: 1 }),
    );
  });

  it("should include url, version, and timestamp", async () => {
    setupMocks();
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.url).toBe("https://example.com");
    expect(report.version).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(report.schemaVersion).toBe("1.0");
  });

  it("should include pageDimensions in report", async () => {
    mockCrawlPage.mockResolvedValue(
      makeCrawlResult({
        pageDimensions: { width: 1280, height: 2000 },
        pageScreenshotAssetId: "page-screenshot",
        assets: [makeInlineAsset("page-screenshot", "data")],
      }),
    );
    mockRunRules.mockResolvedValue([]);
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.pageDimensions).toEqual({ width: 1280, height: 2000 });
  });

  it("omits internal focus-style snapshots from the public report", async () => {
    setupMocks();
    mockCrawlPage.mockResolvedValue(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            hasFocusIndicator: true,
            focusedStyleSnapshot: {
              self: { outline: "blue" },
              before: {},
              after: {},
            },
            unfocusedStyleSnapshot: {
              self: { outline: "none" },
              before: {},
              after: {},
            },
          }),
        ],
      }),
    );
    const audit = await getAudit();

    const report = await audit("https://example.com");
    const element = report.focusSequence![0] as Record<string, unknown>;

    expect(element.focusedStyleSnapshot).toBeUndefined();
    expect(element.unfocusedStyleSnapshot).toBeUndefined();
    expect(element.selector).toBeDefined();
    expect(element.hasFocusIndicator).toBe(true);
  });

  describe("crawlOnly", () => {
    it("returns the crawl result without running rules or reporters", async () => {
      setupMocks();
      const { crawlOnly } = await import("@/index.js");

      const result = await crawlOnly("https://example.com", {
        waitAfterLoad: 250,
      });

      expect(result).toBe(defaultCrawlResult);
      expect(mockCrawlPage).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({ waitAfterLoad: 250 }),
        expect.any(AbortSignal),
        undefined,
        undefined,
        expect.any(Number),
      );
      expect(mockRunRules).not.toHaveBeenCalled();
      expect(mockRunReporters).not.toHaveBeenCalled();
    });

    it("uses the caller log level and disposes the crawl scope on failure", async () => {
      const error = new Error("crawl failed");
      mockCrawlPage.mockRejectedValue(error);
      const { crawlOnly } = await import("@/index.js");

      await expect(
        crawlOnly("https://example.com", { logLevel: "debug" }),
      ).rejects.toBe(error);
      expect(mockWithLogLevel).toHaveBeenCalledWith(
        "debug",
        expect.any(Function),
      );
    });
  });
});
