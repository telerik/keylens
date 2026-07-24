import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CrawlResult, KeylensConfig, RuleResult } from "@/types/index.js";
import {
  makeCrawlResult,
  makeFocusedElement,
  makeInteractiveElement,
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
}));

vi.mock("@/utils/logger.js", () => ({
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

const mockCrawlPage = vi.mocked(crawlPage);
const mockRunRules = vi.mocked(runRules);
const mockRunReporters = vi.mocked(runReporters);

beforeEach(() => {
  vi.clearAllMocks();
  mockAIInstance.isAvailable.mockReturnValue(false);
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
    pageScreenshot: "base64-screenshot",
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

    expect(mockCrawlPage).toHaveBeenCalledWith("https://example.com", config);
  });

  it("should call runRules with crawl result and config", async () => {
    setupMocks();
    const audit = await getAudit();
    const config: KeylensConfig = { ...DEFAULT_CONFIG };

    await audit("https://example.com", config);

    expect(mockRunRules).toHaveBeenCalledWith(defaultCrawlResult, config);
  });

  it("should call runReporters with report, reporters, and outputDir", async () => {
    setupMocks();
    const audit = await getAudit();
    const config: KeylensConfig = {
      ...DEFAULT_CONFIG,
      reporters: ["cli", "json"],
      outputDir: "./my-output",
    };

    await audit("https://example.com", config);

    expect(mockRunReporters).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com" }),
      ["cli", "json"],
      "./my-output",
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

  it("should calculate correct violation summary", async () => {
    setupMocks();
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.summary.totalErrors).toBe(1);
    expect(report.summary.totalWarnings).toBe(1);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
  });

  it("should include focusSequence and pageScreenshot in report", async () => {
    setupMocks();
    const audit = await getAudit();

    const report = await audit("https://example.com", { ...DEFAULT_CONFIG });

    expect(report.focusSequence).toHaveLength(2);
    expect(report.pageScreenshot).toBe("base64-screenshot");
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
        pageScreenshot: "data",
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
        pageScreenshot: "data",
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
    pageScreenshot: "data",
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
    );
    expect(mockCrawlPage).toHaveBeenCalledWith(
      "https://b.com",
      expect.anything(),
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
