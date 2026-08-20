import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import {
  buildConfig,
  injectSampling,
  compactReport,
  compactMultiPageReport,
  handleAudit,
  handleAuditMultiple,
  handleClassifyWidgets,
  handleValidateFocusOrder,
} from "@/mcp/handlers.js";
import {
  makeAuditReport,
  makeMultiPageReport,
  makeFocusedElement,
  makeCrawlResult,
  makeInteractiveElement,
  makeInlineAsset,
  makeFocusStyleSnapshot,
} from "@tests/helpers/factories.js";
import type {
  AuditReport,
  MultiPageReport,
  CrawlResult,
  RuleResult,
} from "@/types/index.js";

// ─── Mocks ──────────────────────────────────────────────────────

const mockAudit =
  vi.fn<(url: string, config: unknown) => Promise<AuditReport>>();
const mockAuditMultiple =
  vi.fn<(urls: string[], config: unknown) => Promise<MultiPageReport>>();
const mockCrawlOnly =
  vi.fn<(url: string, config: unknown) => Promise<CrawlResult>>();
const mockRenderAuditReport = vi.fn().mockResolvedValue(undefined);
const mockRenderMultiPageReport = vi.fn().mockResolvedValue(undefined);

const mockAIInstance = {
  isAvailable: vi.fn().mockReturnValue(false),
  classifyWidgets: vi.fn().mockResolvedValue([]),
  validateFocusOrder: vi.fn().mockResolvedValue(null),
};

vi.mock("@/index.js", () => ({
  audit: (...args: unknown[]) => mockAudit(...(args as [string, unknown])),
  auditMultiple: (...args: unknown[]) =>
    mockAuditMultiple(...(args as [string[], unknown])),
  crawlOnly: (...args: unknown[]) =>
    mockCrawlOnly(...(args as [string, unknown])),
  renderAuditReport: (...args: unknown[]) => mockRenderAuditReport(...args),
  renderMultiPageReport: (...args: unknown[]) =>
    mockRenderMultiPageReport(...args),
  AIAnalyzer: class MockAIAnalyzer {
    isAvailable = mockAIInstance.isAvailable;
    classifyWidgets = mockAIInstance.classifyWidgets;
    validateFocusOrder = mockAIInstance.validateFocusOrder;
  },
  DEFAULT_CONFIG: {
    urls: [],
    viewport: { width: 1280, height: 720 },
    maxTabs: 500,
    tabTimeout: 3000,
    waitAfterLoad: 1000,
    rules: {
      keyboardTrap: true,
      unreachableElements: true,
      focusOrderMismatch: true,
      tabindexAbuse: true,
      missingFocusIndicator: true,
      skipLink: true,
      focusNotObscured: true,
      focusAfterInteraction: true,
    },
    reporters: ["cli"],
    outputDir: "./keylens-report",
    browser: "chromium",
    ai: {
      enabled: false,
      provider: "anthropic",
      features: {
        focusOrderValidation: true,
        fixSuggestions: true,
        widgetClassification: false,
        reportSummary: true,
        focusIndicatorQuality: false,
        accessibleNameInference: false,
        crossPagePatterns: true,
      },
    },
    headed: false,
    capture: {
      page: "none",
      elements: false,
      limits: {
        maxElements: 200,
        maxDimension: 16384,
        maxPixels: 40000000,
        maxBytes: 52428800,
      },
    },
    timeouts: {},
    interactions: {
      enabled: false,
      maxCases: 20,
      timeout: 2000,
      actions: ["click"],
      isolation: "reload",
      navigation: "block",
      excludeDestructive: true,
    },
    multiPage: { concurrency: 2 },
  },
}));

vi.mock("@/utils/logger.js", () => ({
  setLogLevel: vi.fn(),
}));

// ─── Tests ──────────────────────────────────────────────────────

describe("buildConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns defaults with reporters=[] when no options", () => {
    const config = buildConfig();
    expect(config.reporters).toEqual([]);
    expect(config.outputDir).toBe(join(process.cwd(), "keylens-report"));
    expect(config.headed).toBe(false);
    expect(config.browser).toBe("chromium");
    expect(config.maxTabs).toBe(500);
  });

  it("applies caller options", () => {
    const config = buildConfig({
      browser: "firefox",
      maxTabs: 100,
      viewport: { width: 800, height: 600 },
      screenshots: true,
      interactions: true,
      ai: true,
    });

    expect(config.browser).toBe("firefox");
    expect(config.maxTabs).toBe(100);
    expect(config.viewport).toEqual({ width: 800, height: 600 });
    expect(config.capture.elements).toBe(true);
    expect(config.interactions.enabled).toBe(true);
    expect(config.ai.enabled).toBe(true);
  });

  it("does not leak capture mutations between requests", () => {
    const visual = buildConfig({ screenshots: true });
    visual.capture.page = "full";
    const next = buildConfig();

    expect(next.capture).toEqual(
      expect.objectContaining({ page: "none", elements: false }),
    );
    expect(next.capture).not.toBe(visual.capture);
    expect(next.capture.limits).not.toBe(visual.capture.limits);
  });

  it("reads KEYLENS_BROWSER env var", () => {
    process.env.KEYLENS_BROWSER = "webkit";
    const config = buildConfig();
    expect(config.browser).toBe("webkit");
  });

  it("reads KEYLENS_MAX_TABS env var", () => {
    process.env.KEYLENS_MAX_TABS = "200";
    const config = buildConfig();
    expect(config.maxTabs).toBe(200);
  });

  it("reads ANTHROPIC_API_KEY env var", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    const config = buildConfig();
    expect(config.ai.apiKey).toBe("sk-test-key");
  });

  it("prefers KEYLENS_AI_API_KEY over ANTHROPIC_API_KEY", () => {
    process.env.KEYLENS_AI_API_KEY = "keylens-key";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    const config = buildConfig();
    expect(config.ai.apiKey).toBe("keylens-key");
  });

  it("does not use an OpenAI key for the default Anthropic provider", () => {
    process.env.OPENAI_API_KEY = "openai-key";

    const config = buildConfig();

    expect(config.ai.apiKey).toBeUndefined();
  });

  it("caller options override env vars", () => {
    process.env.KEYLENS_BROWSER = "webkit";
    const config = buildConfig({ browser: "firefox" });
    expect(config.browser).toBe("firefox");
  });

  it("rejects invalid KEYLENS_BROWSER values", () => {
    process.env.KEYLENS_BROWSER = "invalid-browser";
    expect(() => buildConfig()).toThrow("browser");
  });

  it("rejects invalid KEYLENS_MAX_TABS values", () => {
    process.env.KEYLENS_MAX_TABS = "not-a-number";
    expect(() => buildConfig()).toThrow("maxTabs");
  });

  it("applies execution profiles before explicit options", () => {
    const fast = buildConfig({ profile: "fast" });
    const overridden = buildConfig({ profile: "fast", maxTabs: 50 });

    expect(fast.tabDelay).toBe(25);
    expect(fast.maxTabs).toBe(400);
    expect(overridden.maxTabs).toBe(50);
  });

  it("applies reporters and outputDir options", () => {
    const config = buildConfig({
      reporters: ["html", "json"],
      outputDir: "./my-reports",
    });
    expect(config.reporters).toEqual(["html", "json"]);
    expect(config.outputDir).toBe("./my-reports");
  });

  it("applies partial viewport (only width)", () => {
    const config = buildConfig({ viewport: { width: 400 } });
    expect(config.viewport).toEqual({ width: 400, height: 720 });
  });
});

describe("compactReport", () => {
  it("preserves the report schema version", () => {
    const report = makeAuditReport();

    expect(compactReport(report).schemaVersion).toBe(report.schemaVersion);
  });

  it("removes outerHTML from focusSequence elements", () => {
    const report = makeAuditReport({
      focusSequence: [
        makeFocusedElement({ outerHTML: '<button class="big">Click</button>' }),
      ],
    });

    const compact = compactReport(report);

    // compactElement does not include outerHTML
    expect(
      (compact.focusSequence![0] as Record<string, unknown>).outerHTML,
    ).toBeUndefined();
  });

  it("removes boundingRect, pageRect, style snapshots from elements", () => {
    const report = makeAuditReport({
      focusSequence: [
        makeFocusedElement({
          boundingRect: { x: 10, y: 20, width: 100, height: 40 },
          pageRect: { x: 10, y: 20, width: 100, height: 40 },
          focusedStyleSnapshot: makeFocusStyleSnapshot({
            self: { outline: "rgb(0, 0, 255) solid 2px" },
          }),
          unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
        }),
      ],
    });

    const compact = compactReport(report);
    const el = compact.focusSequence![0] as Record<string, unknown>;

    expect(el.boundingRect).toBeUndefined();
    expect(el.pageRect).toBeUndefined();
    expect(el.focusedStyleSnapshot).toBeUndefined();
    expect(el.unfocusedStyleSnapshot).toBeUndefined();
  });

  it("removes screenshot assets and their references", () => {
    const report = makeAuditReport({
      pageScreenshotAssetId: "page",
      assets: [
        makeInlineAsset("page", "base64-page"),
        makeInlineAsset(
          "focused",
          "base64-focused",
          "focused-element-screenshot",
        ),
        makeInlineAsset(
          "unfocused",
          "base64-unfocused",
          "unfocused-element-screenshot",
        ),
      ],
      focusSequence: [
        makeFocusedElement({
          focusedScreenshotAssetId: "focused",
          unfocusedScreenshotAssetId: "unfocused",
        }),
      ],
    });

    const compact = compactReport(report);

    expect(compact.pageScreenshotAssetId).toBeUndefined();
    expect(compact.focusSequence![0].focusedScreenshotAssetId).toBeUndefined();
    expect(compact.assets).toBeUndefined();
  });

  it("removes the config object", () => {
    const report = makeAuditReport({
      config: { browser: "chromium", maxTabs: 500 },
    });

    const compact = compactReport(report);

    expect((compact as Record<string, unknown>).config).toBeUndefined();
  });

  it("strips outerHTML from rule violation elements", () => {
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "tabindex-abuse",
          passed: false,
          violations: [
            {
              ruleId: "tabindex-abuse",
              ruleName: "Tabindex Abuse",
              severity: "warning" as const,
              message: "Positive tabindex",
              elements: [
                {
                  selector: "input.search",
                  outerHTML: '<input tabindex="5">',
                  tabPosition: 1,
                },
              ],
              impact: "Medium",
            },
          ],
          duration: 5,
        },
      ],
    });

    const compact = compactReport(report);
    const el = compact.rules[0]!.violations[0]!.elements[0]!;

    expect(el.outerHTML).toBe("");
    expect(el.selector).toBe("input.search");
    expect(el.tabPosition).toBe(1);
  });

  it("strips outerHTML from widgetClassifications", () => {
    const report = makeAuditReport({
      widgetClassifications: [
        {
          element: {
            selector: "div.modal",
            tagName: "div",
            role: "dialog",
            accessibleName: "Settings",
            outerHTML: '<div role="dialog">...',
          },
          pattern: "dialog" as const,
          confidence: 0.9,
          expectedKeyboard: [],
        },
      ],
    });

    const compact = compactReport(report);

    expect(compact.widgetClassifications![0]!.element.outerHTML).toBe("");
    expect(compact.widgetClassifications![0]!.element.selector).toBe(
      "div.modal",
    );
  });

  it("strips outerHTML from accessibleNameSuggestions", () => {
    const report = makeAuditReport({
      accessibleNameSuggestions: [
        {
          element: {
            selector: "button.icon",
            tagName: "button",
            role: "button",
            outerHTML: '<button class="icon"><svg>...</svg></button>',
          },
          suggestedLabel: "Close",
          confidence: 0.8,
          reasoning: "Icon button needs label",
        },
      ],
    });

    const compact = compactReport(report);

    expect(compact.accessibleNameSuggestions![0]!.element.outerHTML).toBe("");
    expect(compact.accessibleNameSuggestions![0]!.suggestedLabel).toBe("Close");
  });

  it("preserves essential fields", () => {
    const report = makeAuditReport({
      url: "https://example.com",
      summary: {
        totalErrors: 2,
        totalWarnings: 1,
        totalInfo: 0,
        passed: 5,
        failed: 2,
      },
      focusSequence: [
        makeFocusedElement({
          selector: "button.save",
          role: "button",
          accessibleName: "Save",
        }),
      ],
      aiSummary: "Good overall",
    });

    const compact = compactReport(report);

    expect(compact.url).toBe("https://example.com");
    expect(compact.summary.totalErrors).toBe(2);
    expect(compact.focusSequence![0]!.selector).toBe("button.save");
    expect(compact.focusSequence![0]!.role).toBe("button");
    expect(compact.focusSequence![0]!.accessibleName).toBe("Save");
    expect(compact.aiSummary).toBe("Good overall");
  });
});

describe("compactMultiPageReport", () => {
  it("preserves the report schema version", () => {
    const report = makeMultiPageReport();

    expect(compactMultiPageReport(report).schemaVersion).toBe(
      report.schemaVersion,
    );
  });

  it("drops focusSequence from individual pages", () => {
    const report = makeMultiPageReport({
      pages: [
        makeAuditReport({
          url: "https://a.com",
          focusSequence: [makeFocusedElement()],
        }),
      ],
    });

    const compact = compactMultiPageReport(report);

    expect(
      (compact.pages[0] as Record<string, unknown>).focusSequence,
    ).toBeUndefined();
  });

  it("keeps per-page url, summary, and violations", () => {
    const rules: RuleResult[] = [
      {
        ruleId: "keyboard-trap",
        passed: false,
        violations: [
          {
            ruleId: "keyboard-trap",
            ruleName: "Keyboard Trap",
            severity: "error" as const,
            message: "Focus trapped",
            elements: [{ selector: "div.modal", outerHTML: "<div>" }],
            impact: "Critical",
          },
        ],
        duration: 3,
      },
    ];

    const report = makeMultiPageReport({
      pages: [
        makeAuditReport({
          url: "https://a.com",
          rules,
          summary: {
            totalErrors: 1,
            totalWarnings: 0,
            totalInfo: 0,
            passed: 6,
            failed: 1,
          },
        }),
      ],
    });

    const compact = compactMultiPageReport(report);

    expect(compact.pages[0]!.url).toBe("https://a.com");
    expect(compact.pages[0]!.summary.totalErrors).toBe(1);
    expect(compact.pages[0]!.rules.length).toBeGreaterThan(0);
  });

  it("strips outerHTML from per-page violations", () => {
    const report = makeMultiPageReport({
      pages: [
        makeAuditReport({
          rules: [
            {
              ruleId: "tabindex-abuse",
              passed: false,
              violations: [
                {
                  ruleId: "tabindex-abuse",
                  ruleName: "Tabindex Abuse",
                  severity: "warning" as const,
                  message: "Positive tabindex",
                  elements: [
                    { selector: "input", outerHTML: '<input tabindex="5">' },
                  ],
                  impact: "Medium",
                },
              ],
              duration: 2,
            },
          ],
        }),
      ],
    });

    const compact = compactMultiPageReport(report);
    const el = compact.pages[0]!.rules[0]!.violations[0]!.elements[0]!;

    expect(el.outerHTML).toBe("");
    expect(el.selector).toBe("input");
  });

  it("preserves top-level aggregate summary and AI fields", () => {
    const report = makeMultiPageReport({
      summary: {
        totalPages: 2,
        totalErrors: 3,
        totalWarnings: 1,
        totalInfo: 0,
        pagesWithErrors: 2,
      },
      aiSummary: "Cross-page summary",
      crossPagePatterns: [
        {
          type: "inconsistent-order" as const,
          description: "Tab order differs",
          affectedPages: ["https://a.com", "https://b.com"],
          severity: "warning" as const,
          suggestion: "Standardize nav order",
        },
      ],
    });

    const compact = compactMultiPageReport(report);

    expect(compact.summary.totalErrors).toBe(3);
    expect(compact.aiSummary).toBe("Cross-page summary");
    expect(compact.crossPagePatterns).toHaveLength(1);
  });
});

describe("handleAudit", () => {
  beforeEach(() => {
    mockAudit.mockReset();
    mockAuditMultiple.mockReset();
    mockRenderAuditReport.mockReset().mockResolvedValue(undefined);
  });

  it("calls audit with correct URL and returns JSON", async () => {
    const report = makeAuditReport({ url: "https://test.com" });
    mockAudit.mockResolvedValue(report);

    const result = await handleAudit({ url: "https://test.com" });

    expect(mockAudit).toHaveBeenCalledOnce();
    expect(mockAudit.mock.calls[0]![0]).toBe("https://test.com");
    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.url).toBe("https://test.com");
  });

  it("returns compact JSON without pretty-printing", async () => {
    const report = makeAuditReport({ url: "https://test.com" });
    mockAudit.mockResolvedValue(report);

    const result = await handleAudit({ url: "https://test.com" });
    const text = result.content[0]!.text;

    // No pretty-printing — should not start with newlines/indentation
    expect(text).not.toMatch(/^\{\n\s/);
  });

  it("strips outerHTML, boundingRect, pageRect, config from response", async () => {
    const report = makeAuditReport({
      config: { browser: "chromium" },
      focusSequence: [
        makeFocusedElement({
          outerHTML: "<button>Click</button>",
          boundingRect: { x: 0, y: 0, width: 100, height: 40 },
          pageRect: { x: 0, y: 0, width: 100, height: 40 },
          focusedStyleSnapshot: makeFocusStyleSnapshot({
            self: { outline: "rgb(0, 0, 255) solid 2px" },
          }),
        }),
      ],
    });
    mockAudit.mockResolvedValue(report);

    const result = await handleAudit({ url: "https://test.com" });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.config).toBeUndefined();
    expect(parsed.focusSequence[0].outerHTML).toBeUndefined();
    expect(parsed.focusSequence[0].boundingRect).toBeUndefined();
    expect(parsed.focusSequence[0].pageRect).toBeUndefined();
    expect(parsed.focusSequence[0].focusedStyleSnapshot).toBeUndefined();
  });

  it("strips screenshots from response", async () => {
    const report = makeAuditReport({
      pageScreenshotAssetId: "page",
      assets: [
        makeInlineAsset("page", "base64-data"),
        makeInlineAsset(
          "focused",
          "base64-focused",
          "focused-element-screenshot",
        ),
      ],
      focusSequence: [
        makeFocusedElement({ focusedScreenshotAssetId: "focused" }),
      ],
    });
    mockAudit.mockResolvedValue(report);

    const result = await handleAudit({ url: "https://test.com" });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.pageScreenshotAssetId).toBeUndefined();
    expect(parsed.focusSequence[0].focusedScreenshotAssetId).toBeUndefined();
    expect(parsed.assets).toBeUndefined();
  });

  it("strips outerHTML from rule violation elements", async () => {
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "tabindex-abuse",
          passed: false,
          violations: [
            {
              ruleId: "tabindex-abuse",
              ruleName: "Tabindex Abuse",
              severity: "warning" as const,
              message: "Positive tabindex",
              elements: [
                { selector: "input.s", outerHTML: '<input tabindex="5">' },
              ],
              impact: "Medium",
            },
          ],
          duration: 5,
        },
      ],
    });
    mockAudit.mockResolvedValue(report);

    const result = await handleAudit({ url: "https://test.com" });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.rules[0].violations[0].elements[0].outerHTML).toBe("");
    expect(parsed.rules[0].violations[0].elements[0].selector).toBe("input.s");
  });

  it("returns isError on audit failure", async () => {
    mockAudit.mockRejectedValue(new Error("Connection refused"));

    const result = await handleAudit({ url: "https://bad.test" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Connection refused");
  });

  it("passes options to buildConfig", async () => {
    mockAudit.mockResolvedValue(makeAuditReport());

    await handleAudit({
      url: "https://test.com",
      options: { browser: "firefox", maxTabs: 50 },
    });

    const config = mockAudit.mock.calls[0]![1] as Record<string, unknown>;
    expect(config.browser).toBe("firefox");
    expect(config.maxTabs).toBe(50);
  });

  it("does not render when no reporters are configured", async () => {
    mockAudit.mockResolvedValue(makeAuditReport());

    await handleAudit({ url: "https://test.com" });

    expect(mockRenderAuditReport).not.toHaveBeenCalled();
  });

  it("renders with reporter deadlines when reporters are specified", async () => {
    const report = makeAuditReport({ url: "https://test.com" });
    mockAudit.mockResolvedValue(report);

    await handleAudit({
      url: "https://test.com",
      options: { reporters: ["html", "cli"], outputDir: "./out" },
    });

    expect(mockRenderAuditReport).toHaveBeenCalledOnce();
    const [calledReport, calledReporters, calledDir, options] =
      mockRenderAuditReport.mock.calls[0]!;
    expect(calledReporters).toEqual(["html", "cli"]);
    expect(calledDir).toBe("./out");
    expect(calledReport).toBe(report);
    expect(options).toBe("silent");
  });
});

describe("handleAuditMultiple", () => {
  beforeEach(() => {
    mockAudit.mockReset();
    mockAuditMultiple.mockReset();
    mockRenderMultiPageReport.mockReset().mockResolvedValue(undefined);
  });

  it("calls auditMultiple with correct URLs", async () => {
    const report = makeMultiPageReport({
      urls: ["https://a.com", "https://b.com"],
    });
    mockAuditMultiple.mockResolvedValue(report);

    const result = await handleAuditMultiple({
      urls: ["https://a.com", "https://b.com"],
    });

    expect(mockAuditMultiple).toHaveBeenCalledOnce();
    expect(mockAuditMultiple.mock.calls[0]![0]).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
    expect(result.isError).toBeUndefined();
  });

  it("does not render multi-page output when no reporters are configured", async () => {
    mockAuditMultiple.mockResolvedValue(makeMultiPageReport());

    await handleAuditMultiple({ urls: ["https://a.com"] });

    expect(mockRenderMultiPageReport).not.toHaveBeenCalled();
  });

  it("renders multi-page output with reporter deadlines", async () => {
    const report = makeMultiPageReport();
    mockAuditMultiple.mockResolvedValue(report);

    await handleAuditMultiple({
      urls: ["https://a.com"],
      options: { reporters: ["html", "json"], outputDir: "./out" },
    });

    expect(mockRenderMultiPageReport).toHaveBeenCalledOnce();
    const [calledReport, calledReporters, calledDir, options] =
      mockRenderMultiPageReport.mock.calls[0]!;
    expect(calledReporters).toEqual(["html", "json"]);
    expect(calledDir).toBe("./out");
    expect(calledReport).toBe(report);
    expect(options).toBe("silent");
  });

  it("returns isError on failure", async () => {
    mockAuditMultiple.mockRejectedValue(new Error("Timeout"));

    const result = await handleAuditMultiple({ urls: ["https://a.com"] });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Timeout");
  });
});

describe("handleClassifyWidgets", () => {
  beforeEach(() => {
    mockCrawlOnly.mockReset();
    mockAIInstance.isAvailable.mockReturnValue(true);
    mockAIInstance.classifyWidgets.mockResolvedValue([]);
  });

  it("calls crawlOnly instead of full audit", async () => {
    mockCrawlOnly.mockResolvedValue(
      makeCrawlResult({ interactiveElements: [] }),
    );

    await handleClassifyWidgets({ url: "https://test.com" });

    expect(mockCrawlOnly).toHaveBeenCalledOnce();
    expect(mockCrawlOnly.mock.calls[0]![0]).toBe("https://test.com");
    // Should NOT call full audit
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns 'no widgets' message when none detected", async () => {
    mockCrawlOnly.mockResolvedValue(
      makeCrawlResult({ interactiveElements: [] }),
    );
    mockAIInstance.classifyWidgets.mockResolvedValue([]);

    const result = await handleClassifyWidgets({ url: "https://test.com" });

    expect(result.content[0]!.text).toContain("No complex ARIA widgets");
  });

  it("returns classifications with outerHTML stripped", async () => {
    const classifications = [
      {
        element: {
          selector: "div.modal",
          tagName: "div",
          role: "dialog",
          accessibleName: "Settings",
          outerHTML: '<div role="dialog">',
        },
        pattern: "dialog" as const,
        confidence: 0.95,
        expectedKeyboard: [{ key: "Escape", expectedBehavior: "Close dialog" }],
      },
    ];
    mockCrawlOnly.mockResolvedValue(
      makeCrawlResult({
        interactiveElements: [makeInteractiveElement({ role: "dialog" })],
      }),
    );
    mockAIInstance.classifyWidgets.mockResolvedValue(classifications);

    const result = await handleClassifyWidgets({ url: "https://test.com" });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].pattern).toBe("dialog");
    expect(parsed[0].element.outerHTML).toBe("");
    expect(parsed[0].element.selector).toBe("div.modal");
  });

  it("returns isError when crawl fails", async () => {
    mockCrawlOnly.mockRejectedValue(new Error("Browser crashed"));

    const result = await handleClassifyWidgets({ url: "https://test.com" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Browser crashed");
  });
});

describe("handleValidateFocusOrder", () => {
  beforeEach(() => {
    mockCrawlOnly.mockReset();
    mockAIInstance.isAvailable.mockReturnValue(true);
    mockAIInstance.validateFocusOrder.mockResolvedValue(null);
  });

  it("calls crawlOnly instead of full audit", async () => {
    mockCrawlOnly.mockResolvedValue(makeCrawlResult({ focusSequence: [] }));

    await handleValidateFocusOrder({ url: "https://test.com" });

    expect(mockCrawlOnly).toHaveBeenCalledOnce();
    expect(mockCrawlOnly.mock.calls[0]![0]).toBe("https://test.com");
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns raw focus sequence when AI unavailable", async () => {
    mockAIInstance.isAvailable.mockReturnValue(false);
    mockCrawlOnly.mockResolvedValue(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ selector: "a.nav", tagName: "a", role: "link" }),
          makeFocusedElement({
            selector: "button.cta",
            tagName: "button",
            role: "button",
          }),
        ],
        cycleCompleted: true,
      }),
    );

    const result = await handleValidateFocusOrder({ url: "https://test.com" });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.note).toContain("AI analysis unavailable");
    expect(parsed.focusSequence).toHaveLength(2);
    expect(parsed.focusSequence[0].position).toBe(1);
    expect(parsed.focusSequence[1].selector).toBe("button.cta");
  });

  it("returns AI analysis when available", async () => {
    const analysis = {
      summary: "Focus order is logical",
      issues: [],
      overallAssessment: "good" as const,
    };
    mockCrawlOnly.mockResolvedValue(
      makeCrawlResult({
        focusSequence: [makeFocusedElement()],
        pageScreenshotAssetId: "page",
        assets: [makeInlineAsset("page", "data")],
      }),
    );
    mockAIInstance.validateFocusOrder.mockResolvedValue(analysis);

    const result = await handleValidateFocusOrder({ url: "https://test.com" });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.overallAssessment).toBe("good");
    expect(parsed.issues).toEqual([]);
  });

  it("returns isError on failure", async () => {
    mockCrawlOnly.mockRejectedValue(new Error("Browser crashed"));

    const result = await handleValidateFocusOrder({ url: "https://test.com" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Browser crashed");
  });
});

// ─── Sampling Injection ──────────────────────────────────────────

describe("injectSampling", () => {
  it("injects transport when client supports sampling and no API key", () => {
    const config = buildConfig();
    const mockServer = {
      getClientCapabilities: vi.fn().mockReturnValue({ sampling: {} }),
    };

    injectSampling(config, mockServer as never);

    expect(config.ai.transport).toBeDefined();
    expect(config.ai.enabled).toBe(true);
  });

  it("does not inject transport when API key is set", () => {
    const config = buildConfig({ ai: true });
    config.ai.apiKey = "sk-test-key";
    const mockServer = {
      getClientCapabilities: vi.fn().mockReturnValue({ sampling: {} }),
    };

    injectSampling(config, mockServer as never);

    expect(config.ai.transport).toBeUndefined();
  });

  it("does not inject transport when client lacks sampling capability", () => {
    const config = buildConfig();
    const mockServer = {
      getClientCapabilities: vi.fn().mockReturnValue({}),
    };

    injectSampling(config, mockServer as never);

    expect(config.ai.transport).toBeUndefined();
    expect(config.ai.enabled).toBe(false);
  });

  it("does not inject transport when no server is provided", () => {
    const config = buildConfig();

    injectSampling(config);

    expect(config.ai.transport).toBeUndefined();
  });
});

describe("handlers pass server for sampling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.KEYLENS_AI_KEY;
    delete process.env.KEYLENS_AI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("handleAudit checks client sampling capability", async () => {
    const mockServer = {
      getClientCapabilities: vi.fn().mockReturnValue({ sampling: {} }),
    };
    mockAudit.mockResolvedValue(makeAuditReport());

    const result = await handleAudit(
      { url: "https://test.com" },
      mockServer as never,
    );

    expect(mockServer.getClientCapabilities).toHaveBeenCalled();
    // Config should have AI enabled via sampling
    const calledConfig = mockAudit.mock.calls[0]![1] as {
      ai: { enabled: boolean };
    };
    expect(calledConfig.ai.enabled).toBe(true);
    expect(result.isError).toBeUndefined();
  });

  it("handleAuditMultiple checks client sampling capability", async () => {
    const mockServer = {
      getClientCapabilities: vi.fn().mockReturnValue({ sampling: {} }),
    };
    mockAuditMultiple.mockResolvedValue(makeMultiPageReport());

    const result = await handleAuditMultiple(
      { urls: ["https://test.com"] },
      mockServer as never,
    );

    expect(mockServer.getClientCapabilities).toHaveBeenCalled();
    const calledConfig = mockAuditMultiple.mock.calls[0]![1] as {
      ai: { enabled: boolean };
    };
    expect(calledConfig.ai.enabled).toBe(true);
    expect(result.isError).toBeUndefined();
  });
});
