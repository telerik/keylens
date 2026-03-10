import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeAuditReport,
  makeFocusedElement,
} from "@tests/helpers/factories.js";
import type {
  RuleResult,
  MultiPageReport,
  AIReportSummary,
  FixSuggestion,
  AIFocusOrderResult,
} from "@/types/index.js";

vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, writeFile } from "fs/promises";
const mockMkdir = vi.mocked(mkdir);
const mockWriteFile = vi.mocked(writeFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HTML Reporter", () => {
  async function getReportHTML() {
    const mod = await import("@/reporters/html-reporter.js");
    return mod.reportHTML;
  }

  function getWrittenHTML(): string {
    return mockWriteFile.mock.calls[0]![1] as string;
  }

  it("should create output directory and write file", async () => {
    const reportHTML = await getReportHTML();
    const report = makeAuditReport();

    await reportHTML(report, "./test-output");

    expect(mockMkdir).toHaveBeenCalledWith("./test-output", {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile.mock.calls[0]![0]).toContain("keylens-report.html");
  });

  it("should produce valid HTML structure", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(makeAuditReport(), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain('<html lang="en">');
  });

  it("should include the URL in the report", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({ url: "https://my-site.com/page" }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("https://my-site.com/page");
  });

  it("should include the version", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(makeAuditReport({ version: "1.2.3" }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("1.2.3");
  });

  it("should show red status color when errors exist", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        summary: {
          totalErrors: 2,
          totalWarnings: 1,
          totalInfo: 0,
          passed: 3,
          failed: 2,
        },
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("#ef4444");
  });

  it("should show amber status color when only warnings", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        summary: {
          totalErrors: 0,
          totalWarnings: 3,
          totalInfo: 0,
          passed: 4,
          failed: 1,
        },
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("#f59e0b");
  });

  it("should show green status color when all pass", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        summary: {
          totalErrors: 0,
          totalWarnings: 0,
          totalInfo: 0,
          passed: 5,
          failed: 0,
        },
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("#22c55e");
  });

  it("should render passed rules with PASS badge", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "test-rule",
      passed: true,
      violations: [],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("PASS");
    expect(html).toContain("test-rule");
  });

  it("should render failed rules with issue count", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "bad-rule",
      passed: false,
      violations: [
        {
          ruleId: "bad-rule",
          ruleName: "Bad Rule",
          severity: "error",
          message: "Elements are broken",
          elements: [
            { selector: "div.broken", outerHTML: "<div>broken</div>" },
          ],
          impact: "Critical",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("1 issue(s)");
    expect(html).toContain("Elements are broken");
    expect(html).toContain("div.broken");
    expect(html).toContain("element-item");
    expect(html).toContain("selector-text");
  });

  it("should render tab position badges when tabPosition is present", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "focus-order-mismatch",
      passed: false,
      violations: [
        {
          ruleId: "focus-order-mismatch",
          ruleName: "Focus Order Mismatch",
          severity: "warning",
          message: "3 element(s) have mismatched focus order.",
          elements: [
            { selector: "a.first", outerHTML: "<a>first</a>", tabPosition: 5 },
            {
              selector: "a.second",
              outerHTML: "<a>second</a>",
              tabPosition: 12,
            },
            { selector: "a.third", outerHTML: "<a>third</a>", tabPosition: 1 },
          ],
          impact: "Medium",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("tab-pos");
    expect(html).toContain("#5");
    expect(html).toContain("#12");
    expect(html).toContain("#1");
  });

  it("should collapse elements when more than 3 using details/summary", async () => {
    const reportHTML = await getReportHTML();
    const elements = Array.from({ length: 7 }, (_, i) => ({
      selector: `div.el-${i}`,
      outerHTML: `<div>el-${i}</div>`,
    }));
    const rule: RuleResult = {
      ruleId: "many-elements",
      passed: false,
      violations: [
        {
          ruleId: "many-elements",
          ruleName: "Many Elements",
          severity: "warning",
          message: "7 elements found.",
          elements,
          impact: "Medium",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    // First 3 visible
    expect(html).toContain("div.el-0");
    expect(html).toContain("div.el-1");
    expect(html).toContain("div.el-2");
    // Rest in collapsible
    expect(html).toContain("<details>");
    expect(html).toContain("Show 4 more elements");
    expect(html).toContain("div.el-3");
    expect(html).toContain("div.el-6");
  });

  it("should not use details/summary when 3 or fewer elements", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "few-elements",
      passed: false,
      violations: [
        {
          ruleId: "few-elements",
          ruleName: "Few Elements",
          severity: "warning",
          message: "2 elements found.",
          elements: [
            { selector: "a.one", outerHTML: "<a>one</a>" },
            { selector: "a.two", outerHTML: "<a>two</a>" },
          ],
          impact: "Medium",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("a.one");
    expect(html).toContain("a.two");
    expect(html).not.toContain("<details>");
    expect(html).not.toContain("Show");
  });

  it("should render WCAG reference badges on violations", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "wcag-rule",
      passed: false,
      violations: [
        {
          ruleId: "wcag-rule",
          ruleName: "WCAG Rule",
          severity: "error",
          message: "Has WCAG ref",
          elements: [],
          impact: "High",
          wcag: ["2.4.7", "2.1.1"],
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("wcag-badge");
    expect(html).toContain("WCAG 2.4.7");
    expect(html).toContain("WCAG 2.1.1");
    expect(html).toContain("focus-visible");
    expect(html).toContain("keyboard");
  });

  it("should render impact text on violations", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "impact-rule",
      passed: false,
      violations: [
        {
          ruleId: "impact-rule",
          ruleName: "Impact Rule",
          severity: "warning",
          message: "Something wrong",
          elements: [],
          impact: "Keyboard users cannot navigate past this element.",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("Keyboard users cannot navigate past this element.");
    expect(html).toContain("impact");
  });

  it("should render rule name and description when available", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "my-rule",
      passed: false,
      ruleName: "My Friendly Rule",
      ruleDescription: "Checks for something important.",
      violations: [
        {
          ruleId: "my-rule",
          ruleName: "My Friendly Rule",
          severity: "warning",
          message: "Found issue",
          elements: [],
          impact: "Medium",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("My Friendly Rule");
    expect(html).toContain("Checks for something important.");
    expect(html).toContain("rule-meta");
  });

  it("should render accessible name in element items", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "name-rule",
      passed: false,
      violations: [
        {
          ruleId: "name-rule",
          ruleName: "Name Rule",
          severity: "warning",
          message: "Has names",
          elements: [
            {
              selector: "button.submit",
              outerHTML: "<button>Submit</button>",
              accessibleName: "Submit Form",
            },
            {
              selector: "a.link",
              outerHTML: "<a>Link</a>",
            },
          ],
          impact: "Medium",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("element-name");
    expect(html).toContain("Submit Form");
    // Element without accessibleName should not have the name span
    expect(html).toContain("a.link");
  });

  it("should render fix suggestions when present", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "fixable",
      passed: false,
      violations: [
        {
          ruleId: "fixable",
          ruleName: "Fixable",
          severity: "warning",
          message: "Needs fixing",
          elements: [],
          impact: "Medium",
          fixSuggestion: "Add tabindex=0 to the element",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("Add tabindex=0 to the element");
  });

  it("should render AI summary when present", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({ aiSummary: "Page needs keyboard improvements." }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("Page needs keyboard improvements.");
    expect(html).toContain("AI Summary");
  });

  it("should not render AI summary when absent", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(makeAuditReport({ aiSummary: undefined }), "./out");

    const html = getWrittenHTML();
    expect(html).not.toContain("AI Summary");
  });

  it("should escape HTML-special characters in selectors and messages", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "xss-test",
      passed: false,
      violations: [
        {
          ruleId: "xss-test",
          ruleName: "XSS Test",
          severity: "error",
          message: 'Contains <script>alert("xss")</script>',
          elements: [
            {
              selector: 'div[data-x="<evil>"]',
              outerHTML: "<div>safe</div>",
            },
          ],
          impact: "High",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should render structured FixSuggestion with code diff", async () => {
    const reportHTML = await getReportHTML();
    const fix: FixSuggestion = {
      summary: "Add outline to button",
      codeBefore: "outline: none;",
      codeAfter: "outline: 2px solid blue;",
      wcagRef: "2.4.7",
      estimatedEffort: "low",
      explanation: "Removing outline hides the focus indicator.",
    };
    const rule: RuleResult = {
      ruleId: "structured-fix",
      passed: false,
      violations: [
        {
          ruleId: "structured-fix",
          ruleName: "Structured Fix",
          severity: "warning",
          message: "Missing focus style",
          elements: [],
          impact: "Medium",
          fixSuggestion: fix,
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("Add outline to button");
    expect(html).toContain("outline: none;");
    expect(html).toContain("outline: 2px solid blue;");
    expect(html).toContain("low effort");
    expect(html).toContain("Removing outline hides the focus indicator.");
  });

  it("should render structured AIReportSummary", async () => {
    const reportHTML = await getReportHTML();
    const aiSummary: AIReportSummary = {
      overview: "The page has major keyboard traps.",
      criticalIssues: ["Modal traps focus indefinitely"],
      prioritizedFixes: [
        { fix: "Add Escape handler to modal", effort: "low", impact: "high" },
      ],
      aiSeverityRating: 35,
      recommendation: "Fix the keyboard trap first.",
    };
    await reportHTML(makeAuditReport({ aiSummary }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("The page has major keyboard traps.");
    expect(html).toContain("Modal traps focus indefinitely");
    expect(html).toContain("Add Escape handler to modal");
    expect(html).toContain("35");
    expect(html).toContain("Fix the keyboard trap first.");
  });

  it("should render structured AIFocusOrderResult", async () => {
    const reportHTML = await getReportHTML();
    const analysis: AIFocusOrderResult = {
      summary: "Focus order has issues.",
      issues: [
        {
          elementIndex: 2,
          description: "Footer focused before main content",
          severity: "error",
          suggestion: "Reorder DOM to place footer after main",
        },
      ],
      overallAssessment: "poor",
    };
    await reportHTML(
      makeAuditReport({ aiFocusOrderAnalysis: analysis }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("Focus order has issues.");
    expect(html).toContain("Footer focused before main content");
    expect(html).toContain("Reorder DOM to place footer after main");
    expect(html).toContain("poor");
  });

  it("should render widget classifications", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        widgetClassifications: [
          {
            element: {
              selector: "div.tabs",
              tagName: "div",
              role: "tablist",
              accessibleName: "Navigation",
              outerHTML: "<div>Navigation</div>",
            },
            pattern: "tabs",
            confidence: 0.88,
            expectedKeyboard: [
              { key: "Arrow Right", expectedBehavior: "Move to next tab" },
            ],
          },
        ],
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("Widget Classifications");
    expect(html).toContain("tabs");
    expect(html).toContain("88%");
    expect(html).toContain("Move to next tab");
  });

  it("should render accessible name suggestions", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        accessibleNameSuggestions: [
          {
            element: {
              selector: "button.close",
              tagName: "button",
              role: "button",
              outerHTML: "<button>X</button>",
            },
            suggestedLabel: "Close dialog",
            confidence: 0.9,
            reasoning: "Button has only a single character label.",
          },
        ],
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("Accessible Name Suggestions");
    expect(html).toContain("button.close");
    expect(html).toContain("Close dialog");
    expect(html).toContain("90%");
  });

  it("should render focus indicator quality scores", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        focusIndicatorScores: [
          {
            element: {
              selector: "a.link",
              tagName: "a",
              role: "link",
              accessibleName: "About",
            },
            score: 4,
            contrast: "low",
            visibility: "subtle",
            recommendation: "Use a brighter outline color.",
          },
        ],
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("Focus Indicator Quality");
    expect(html).toContain("a.link");
    expect(html).toContain("4/10");
    expect(html).toContain("Use a brighter outline color.");
  });
});

describe("buildFocusMapHTML", () => {
  async function getBuildFocusMapHTML() {
    const mod = await import("@/reporters/html-reporter.js");
    return mod.buildFocusMapHTML;
  }

  it("should return empty string when no focus sequence", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const result = buildFocusMapHTML([], "base64data");
    expect(result).toBe("");
  });

  it("should return empty string when no screenshot", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });
    const result = buildFocusMapHTML([el], "");
    expect(result).toBe("");
  });

  it("should render markers with percentage positioning", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.first",
      accessibleName: "First",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const result = buildFocusMapHTML([el], "screenshot-data", {
      width: 1280,
      height: 720,
    });

    expect(result).toContain("focus-marker");
    expect(result).toContain("data:image/png;base64,screenshot-data");
    expect(result).toContain("Focus Order Map");
    // Marker should show index 1
    expect(result).toContain(">1</div>");
  });

  it("should render SVG connecting lines between markers", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el1 = makeFocusedElement({
      tabIndex: 1,
      selector: "a.one",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });
    const el2 = makeFocusedElement({
      tabIndex: 2,
      selector: "a.two",
      boundingRect: { x: 300, y: 150, width: 80, height: 30 },
    });

    const result = buildFocusMapHTML([el1, el2], "data", {
      width: 1280,
      height: 720,
    });

    expect(result).toContain("<line");
    expect(result).toContain("stroke-dasharray");
    expect(result).toContain("focus-lines");
  });

  it("should color-code violation markers red", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.bad",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const violationSelectors = new Set(["button.bad"]);
    const result = buildFocusMapHTML(
      [el],
      "data",
      { width: 1280, height: 720 },
      violationSelectors,
    );

    expect(result).toContain("#ef4444");
  });

  it("should use pageRect over boundingRect when available", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.scrolled",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
      pageRect: { x: 100, y: 850, width: 80, height: 30 },
    });

    const result = buildFocusMapHTML([el], "data", {
      width: 1280,
      height: 2000,
    });

    // pageRect.y=850, height=30, center = 865
    // topPct = (865 / 2000) * 100 = 43.25%
    expect(result).toContain("43.250%");
  });
});

describe("Multi-Page HTML Reporter", () => {
  async function getReportMultiHTML() {
    const mod = await import("@/reporters/html-reporter.js");
    return mod.reportMultiHTML;
  }

  function getWrittenHTML(): string {
    return mockWriteFile.mock.calls[0]![1] as string;
  }

  function makeMultiReport(
    overrides: Partial<MultiPageReport> = {},
  ): MultiPageReport {
    return {
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      urls: ["https://a.com", "https://b.com"],
      pages: [
        makeAuditReport({ url: "https://a.com" }),
        makeAuditReport({ url: "https://b.com" }),
      ],
      summary: {
        totalPages: 2,
        totalErrors: 0,
        totalWarnings: 0,
        totalInfo: 0,
        pagesWithErrors: 0,
      },
      ...overrides,
    };
  }

  it("should produce valid HTML with tab navigation", async () => {
    const reportMultiHTML = await getReportMultiHTML();
    await reportMultiHTML(makeMultiReport(), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("tab-btn");
    expect(html).toContain("tab-panel");
    expect(html).toContain("Multi-Page Report");
  });

  it("should include all page URLs", async () => {
    const reportMultiHTML = await getReportMultiHTML();
    await reportMultiHTML(makeMultiReport(), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("https://a.com");
    expect(html).toContain("https://b.com");
  });

  it("should show aggregate summary", async () => {
    const reportMultiHTML = await getReportMultiHTML();
    await reportMultiHTML(
      makeMultiReport({
        summary: {
          totalPages: 3,
          totalErrors: 5,
          totalWarnings: 2,
          totalInfo: 0,
          pagesWithErrors: 2,
        },
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("3"); // totalPages
    expect(html).toContain("Pages with Errors");
  });

  it("should include tab switching JavaScript", async () => {
    const reportMultiHTML = await getReportMultiHTML();
    await reportMultiHTML(makeMultiReport(), "./out");

    const html = getWrittenHTML();
    expect(html).toContain("<script>");
    expect(html).toContain("tab-btn");
  });
});
