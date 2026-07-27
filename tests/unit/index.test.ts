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
  markReachedElements: vi.fn(),
}));

vi.mock("@/rules/index.js", () => ({
  runRules: vi.fn(),
}));

vi.mock("@/reporters/index.js", () => ({
  runReporters: vi.fn().mockResolvedValue(undefined),
  runMultiReporters: vi.fn().mockResolvedValue(undefined),
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

const mockAIInstance = {
  isAvailable: vi.fn().mockReturnValue(false),
  generateFixSuggestions: vi.fn().mockResolvedValue(undefined),
  validateFocusOrder: vi.fn().mockResolvedValue(null),
  generateSummary: vi.fn().mockResolvedValue(null),
  classifyWidgets: vi.fn().mockResolvedValue([]),
  inferAccessibleNames: vi.fn().mockResolvedValue([]),
  scoreFocusIndicatorQuality: vi.fn().mockResolvedValue([]),
  generateMultiPageSummary: vi.fn().mockResolvedValue(null),
  detectCrossPagePatterns: vi.fn().mockResolvedValue([]),
};

vi.mock("@/ai/index.js", () => ({
  AIAnalyzer: class MockAIAnalyzer {
    isAvailable = mockAIInstance.isAvailable;
    generateFixSuggestions = mockAIInstance.generateFixSuggestions;
    validateFocusOrder = mockAIInstance.validateFocusOrder;
    generateSummary = mockAIInstance.generateSummary;
    classifyWidgets = mockAIInstance.classifyWidgets;
    inferAccessibleNames = mockAIInstance.inferAccessibleNames;
    scoreFocusIndicatorQuality = mockAIInstance.scoreFocusIndicatorQuality;
    generateMultiPageSummary = mockAIInstance.generateMultiPageSummary;
    detectCrossPagePatterns = mockAIInstance.detectCrossPagePatterns;
  },
}));

import { crawlPage } from "@/crawler/index.js";
import { runRules } from "@/rules/index.js";
import { runReporters } from "@/reporters/index.js";
import { withLogLevel } from "@/utils/logger.js";

const mockCrawlPage = vi.mocked(crawlPage);
const mockRunRules = vi.mocked(runRules);
const mockRunReporters = vi.mocked(runReporters);
const mockWithLogLevel = vi.mocked(withLogLevel);

beforeEach(() => {
  vi.clearAllMocks();
  mockAIInstance.isAvailable.mockReturnValue(false);
  mockAIInstance.generateFixSuggestions.mockResolvedValue(undefined);
  mockAIInstance.validateFocusOrder.mockResolvedValue(null);
  mockAIInstance.generateSummary.mockResolvedValue(null);
  mockAIInstance.classifyWidgets.mockResolvedValue([]);
  mockAIInstance.inferAccessibleNames.mockResolvedValue([]);
  mockAIInstance.scoreFocusIndicatorQuality.mockResolvedValue([]);
  mockAIInstance.generateMultiPageSummary.mockResolvedValue(null);
  mockAIInstance.detectCrossPagePatterns.mockResolvedValue([]);
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

    it("auditBase returns deterministic results without AI or reporters", async () => {
      setupStageMocks();
      mockAIInstance.isAvailable.mockReturnValue(true);
      const { auditBase } = await import("@/index.js");

      const report = await auditBase("https://example.com", {
        viewport: { width: 800 },
        ai: { enabled: true, apiKey: "secret" },
        reporters: ["json"],
      });

      expect(report.summary.totalWarnings).toBe(1);
      expect(report.config.viewport).toEqual({ width: 800, height: 720 });
      expect(report.config.ai.apiKeyConfigured).toBe(true);
      expect(report.config).not.toHaveProperty("ai.apiKey");
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
      expect(mockAIInstance.generateFixSuggestions).not.toHaveBeenCalled();
      expect(mockRunReporters).not.toHaveBeenCalled();
    });

    it("records environment-backed AI credentials without exposing them", async () => {
      setupStageMocks();
      vi.stubEnv("OPENAI_API_KEY", "environment-secret");
      const { auditBase } = await import("@/index.js");

      try {
        const report = await auditBase("https://example.com", {
          ai: { provider: "openai" },
        });

        expect(report.config.ai.apiKeyConfigured).toBe(true);
        expect(JSON.stringify(report.config)).not.toContain(
          "environment-secret",
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("aborts a crawl before rules or enrichment continue", async () => {
      const controller = new AbortController();
      mockCrawlPage.mockImplementation((_url, _config, signal) => {
        return new Promise<CrawlResult>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      });
      const { auditBase, AuditAbortedError } = await import("@/index.js");

      const pending = auditBase("https://example.com", {
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
      const { auditBase, AuditTimeoutError } = await import("@/index.js");

      const pending = auditBase("https://example.com", {
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
      const { auditBase, AuditTimeoutError } = await import("@/index.js");

      const pending = auditBase("https://example.com", {
        timeouts: { rules: 10 },
      });

      await expect(pending).rejects.toBeInstanceOf(AuditTimeoutError);
      await expect(pending).rejects.toMatchObject({
        code: "TIMEOUT",
        phase: "rules",
        details: { timeoutMs: 10, timeoutKind: "phase" },
      });
    });

    it("enrichAudit does not mutate the deterministic report", async () => {
      setupStageMocks();
      const { auditBase, enrichAudit } = await import("@/index.js");
      const baseReport = await auditBase("https://example.com", {
        viewport: { width: 900 },
      });
      const snapshot = structuredClone(baseReport);
      mockAIInstance.isAvailable.mockReturnValue(true);
      mockAIInstance.generateFixSuggestions.mockImplementationOnce(
        async (violations) => {
          violations[0]!.fixSuggestion = "Use tabindex=0";
        },
      );

      const unsafeOptions = {
        ai: { enabled: true, apiKey: "secret" },
        viewport: { width: 320 },
        rules: { keyboardTrap: false },
      };
      const enriched = await enrichAudit(baseReport, unsafeOptions);

      expect(baseReport).toEqual(snapshot);
      expect(enriched).not.toBe(baseReport);
      expect(enriched.rules[0]!.violations[0]!.fixSuggestion).toBe(
        "Use tabindex=0",
      );
      expect(enriched.config.viewport).toEqual({ width: 900, height: 720 });
      expect(enriched.config.rules.keyboardTrap).toBe(true);
      expect(enriched.config.ai.enabled).toBe(true);
      expect(enriched.config.ai.apiKeyConfigured).toBe(true);
      expect(enriched.config).not.toHaveProperty("ai.apiKey");
      expect(enriched.timings.ai).toEqual(expect.any(Number));
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
          focusReasonable: false,
        },
      ],
    });
    mockRunRules.mockResolvedValue(defaultRuleResults);
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.crawl.interactionsAttempted).toBe(1);
    expect(report.crawl.interactionsFailed).toBe(1);
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

  it("should skip AI when not available", async () => {
    setupMocks();
    mockAIInstance.isAvailable.mockReturnValue(false);
    const audit = await getAudit();

    await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(mockAIInstance.generateFixSuggestions).not.toHaveBeenCalled();
    expect(mockAIInstance.validateFocusOrder).not.toHaveBeenCalled();
    expect(mockAIInstance.generateSummary).not.toHaveBeenCalled();
    expect(mockAIInstance.inferAccessibleNames).not.toHaveBeenCalled();
    expect(mockAIInstance.scoreFocusIndicatorQuality).not.toHaveBeenCalled();
  });

  it("should call AI methods when available", async () => {
    setupMocks();
    mockAIInstance.isAvailable.mockReturnValue(true);
    mockAIInstance.generateSummary.mockResolvedValue("AI summary text");
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(mockAIInstance.generateFixSuggestions).toHaveBeenCalled();
    expect(mockAIInstance.validateFocusOrder).toHaveBeenCalled();
    expect(mockAIInstance.generateSummary).toHaveBeenCalled();
    expect(mockAIInstance.classifyWidgets).toHaveBeenCalled();
    expect(mockAIInstance.inferAccessibleNames).toHaveBeenCalled();
    expect(mockAIInstance.scoreFocusIndicatorQuality).toHaveBeenCalled();
    expect(report.aiSummary).toBe("AI summary text");
  });

  it("should include focusIndicatorScores when AI returns them", async () => {
    setupMocks();
    mockAIInstance.isAvailable.mockReturnValue(true);
    const mockScores = [
      {
        element: {
          selector: "button.test",
          tagName: "button",
          role: "button",
          accessibleName: "Test",
        },
        score: 8,
        contrast: "sufficient",
        visibility: "clear",
      },
    ];
    mockAIInstance.scoreFocusIndicatorQuality.mockResolvedValue(mockScores);
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.focusIndicatorScores).toEqual(mockScores);
  });

  it("should store structured AI summary on report", async () => {
    setupMocks();
    mockAIInstance.isAvailable.mockReturnValue(true);
    const structuredSummary = {
      overview: "Good keyboard navigation.",
      criticalIssues: [],
      prioritizedFixes: [],
      aiSeverityRating: 85,
      recommendation: "Minor improvements needed.",
    };
    mockAIInstance.generateSummary.mockResolvedValue(structuredSummary);
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.aiSummary).toEqual(structuredSummary);
  });

  it("should include accessibleNameSuggestions when AI returns them", async () => {
    setupMocks();
    mockAIInstance.isAvailable.mockReturnValue(true);
    const mockSuggestions = [
      {
        element: {
          selector: "button.icon",
          tagName: "button",
          role: "button",
          outerHTML: '<button class="icon"></button>',
        },
        suggestedLabel: "Close dialog",
        confidence: 0.9,
        reasoning: "Icon button with X symbol",
      },
    ];
    mockAIInstance.inferAccessibleNames.mockResolvedValue(mockSuggestions);
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.accessibleNameSuggestions).toEqual(mockSuggestions);
  });

  it("should pass pageDimensions to validateFocusOrder", async () => {
    mockCrawlPage.mockResolvedValue(
      makeCrawlResult({
        focusSequence: [makeFocusedElement()],
        interactiveElements: [makeInteractiveElement()],
        pageScreenshotAssetId: "page-screenshot",
        assets: [makeInlineAsset("page-screenshot", "data")],
        pageDimensions: { width: 1280, height: 2000 },
      }),
    );
    mockRunRules.mockResolvedValue([]);
    mockAIInstance.isAvailable.mockReturnValue(true);
    const audit = await getAudit();

    await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(mockAIInstance.validateFocusOrder).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      { width: 1280, height: 2000 },
    );
  });

  it("should include widgetClassifications when AI classifies widgets", async () => {
    setupMocks();
    mockAIInstance.isAvailable.mockReturnValue(true);
    const mockClassifications = [
      {
        element: {
          selector: "[role='tablist']",
          tagName: "div",
          role: "tablist",
          accessibleName: "Main tabs",
          outerHTML: '<div role="tablist">...</div>',
        },
        pattern: "tabs",
        confidence: 0.9,
        expectedKeyboard: [
          { key: "Arrow Right", expectedBehavior: "Move to next tab" },
        ],
      },
    ];
    mockAIInstance.classifyWidgets.mockResolvedValue(mockClassifications);
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.widgetClassifications).toEqual(mockClassifications);
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
});

describe("auditMultiple", () => {
  async function getAuditMultiple() {
    const mod = await import("@/index.js");
    return mod.auditMultiple;
  }

  const defaultCrawlResult: CrawlResult = makeCrawlResult({
    focusSequence: [makeFocusedElement({ tabIndex: 1, selector: "button.a" })],
    interactiveElements: [
      makeInteractiveElement({ selector: "button.a", reached: true }),
    ],
    pageScreenshotAssetId: "page-screenshot",
    assets: [makeInlineAsset("page-screenshot", "data")],
  });

  const passingRules: RuleResult[] = [
    { ruleId: "rule-1", passed: true, violations: [], duration: 5 },
  ];

  const failingRules: RuleResult[] = [
    {
      ruleId: "rule-1",
      passed: false,
      violations: [
        {
          ruleId: "rule-1",
          ruleName: "Rule 1",
          severity: "error",
          message: "Fail",
          elements: [],
          impact: "High",
        },
      ],
      duration: 5,
    },
  ];

  it("should return a multi-page report with correct summary", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue(passingRules);
    const auditMultiple = await getAuditMultiple();

    const report = await auditMultiple(["https://a.com", "https://b.com"], {
      ...DEFAULT_CONFIG,
    });

    expect(report.pages).toHaveLength(2);
    expect(report.urls).toEqual(["https://a.com", "https://b.com"]);
    expect(report.summary.totalPages).toBe(2);
    expect(report.summary.totalErrors).toBe(0);
    expect(report.summary.pagesWithErrors).toBe(0);
    expect(report.schemaVersion).toBe("1.0");
  });

  it("should aggregate errors across pages", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    // First page passes, second fails
    mockRunRules
      .mockResolvedValueOnce(passingRules)
      .mockResolvedValueOnce(failingRules);
    const auditMultiple = await getAuditMultiple();

    const report = await auditMultiple(["https://a.com", "https://b.com"], {
      ...DEFAULT_CONFIG,
    });

    expect(report.summary.totalErrors).toBe(1);
    expect(report.summary.pagesWithErrors).toBe(1);
  });

  it("should call crawlPage for each URL", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue(passingRules);
    const auditMultiple = await getAuditMultiple();

    await auditMultiple(["https://a.com", "https://b.com"], {
      ...DEFAULT_CONFIG,
    });

    expect(mockCrawlPage).toHaveBeenCalledTimes(2);
    expect(mockCrawlPage).toHaveBeenCalledWith(
      "https://a.com",
      expect.anything(),
      expect.any(AbortSignal),
    );
    expect(mockCrawlPage).toHaveBeenCalledWith(
      "https://b.com",
      expect.anything(),
      expect.any(AbortSignal),
    );
  });

  it("should call detectCrossPagePatterns and generateMultiPageSummary when AI is available", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue(passingRules);
    mockAIInstance.isAvailable.mockReturnValue(true);
    const auditMultiple = await getAuditMultiple();

    await auditMultiple(["https://a.com", "https://b.com"], {
      ...DEFAULT_CONFIG,
    });

    expect(mockAIInstance.detectCrossPagePatterns).toHaveBeenCalled();
    expect(mockAIInstance.generateMultiPageSummary).toHaveBeenCalled();
  });

  it("should include crossPagePatterns in multi-page report", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue(passingRules);
    mockAIInstance.isAvailable.mockReturnValue(true);
    const mockPatterns = [
      {
        type: "inconsistent-order",
        description: "Nav element at different positions",
        affectedPages: ["https://a.com", "https://b.com"],
        severity: "warning",
        suggestion: "Ensure consistent tab order",
      },
    ];
    mockAIInstance.detectCrossPagePatterns.mockResolvedValue(mockPatterns);
    const auditMultiple = await getAuditMultiple();

    const report = await auditMultiple(["https://a.com", "https://b.com"], {
      ...DEFAULT_CONFIG,
    });

    expect(report.crossPagePatterns).toEqual(mockPatterns);
  });

  it("should include AI summary in multi-page report", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue(passingRules);
    mockAIInstance.isAvailable.mockReturnValue(true);
    mockAIInstance.generateMultiPageSummary.mockResolvedValue(
      "Multi-page AI summary",
    );
    const auditMultiple = await getAuditMultiple();

    const report = await auditMultiple(["https://a.com", "https://b.com"], {
      ...DEFAULT_CONFIG,
    });

    expect(report.aiSummary).toBe("Multi-page AI summary");
  });

  it("should skip AI in auditMultiple when not available", async () => {
    mockCrawlPage.mockResolvedValue(defaultCrawlResult);
    mockRunRules.mockResolvedValue(passingRules);
    mockAIInstance.isAvailable.mockReturnValue(false);
    const auditMultiple = await getAuditMultiple();

    const report = await auditMultiple(["https://a.com", "https://b.com"], {
      ...DEFAULT_CONFIG,
    });

    expect(mockAIInstance.detectCrossPagePatterns).not.toHaveBeenCalled();
    expect(mockAIInstance.generateMultiPageSummary).not.toHaveBeenCalled();
    expect(report.crossPagePatterns).toBeUndefined();
    expect(report.aiSummary).toBeUndefined();
  });
});
