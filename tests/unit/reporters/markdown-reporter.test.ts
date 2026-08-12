import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeAuditReport,
  makeMultiPageReport,
  makeFocusedElement,
} from "@tests/helpers/factories.js";
import type {
  WidgetClassification,
  AccessibleNameSuggestion,
  FocusIndicatorScore,
  AIFocusOrderResult,
  AIReportSummary,
  FixSuggestion,
  CrossPagePattern,
} from "@/types/index.js";

// Mock fs/promises
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

function getWrittenMarkdown(): string {
  return mockWriteFile.mock.calls[0]![1] as string;
}

describe("reportMarkdown", () => {
  async function getReportMarkdown() {
    const mod = await import("@/reporters/markdown-reporter.js");
    return mod.reportMarkdown;
  }

  it("should create output directory and write markdown file", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport();

    await reportMarkdown(report, "./test-output");

    expect(mockMkdir).toHaveBeenCalledWith("./test-output", {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile.mock.calls[0]![0]).toMatch(/keylens-report\.md$/);
  });

  it("should include report header with URL, version, and timestamp", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      url: "https://example.com",
      version: "0.1.0",
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("# Keylens Keyboard Navigation Report");
    expect(md).toContain("https://example.com");
    expect(md).toContain("0.1.0");
  });

  it("should render summary table with score", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      summary: {
        totalErrors: 3,
        totalWarnings: 2,
        totalInfo: 1,
        passed: 5,
        failed: 3,
        score: 72,
      },
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("## Summary");
    expect(md).toContain("| 3 | 2 | 1 | 5 | 3 | 0 | 72/100 |");
  });

  it("should render crawl section", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 15,
        totalInteractiveElements: 20,
        unreachedElements: 5,
        cycleCompleted: true,
        duration: 2500,
      },
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("## Crawl");
    expect(md).toContain("| 15 | 20 | 5 | Yes |");
  });

  it("should render scroll container expansion details when present", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 15,
        totalInteractiveElements: 20,
        unreachedElements: 5,
        cycleCompleted: true,
        duration: 2500,
        prepare: {
          attempted: true,
          dismissals: [],
          warnings: [],
          duration: 50,
          scrollContainerExpanded: {
            selector: "div.parallax",
            originalHeight: 900,
            expandedHeight: 5198,
          },
        },
      },
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain(
      "**Scroll container expanded:** div.parallax (900px -> 5198px)",
    );
  });

  it("should render focus sequence table", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      focusSequence: [
        makeFocusedElement({
          tabIndex: 1,
          tagName: "a",
          role: "link",
          accessibleName: "Home",
          selector: "a.home",
        }),
        makeFocusedElement({
          tabIndex: 2,
          tagName: "button",
          role: "button",
          accessibleName: "Submit",
          selector: "button.submit",
        }),
      ],
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("## Focus Sequence");
    expect(md).toContain("| 1 | a | link | Home |");
    expect(md).toContain("| 2 | button | button | Submit |");
  });

  it("should render rule violations", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "keyboard-trap",
          ruleName: "Keyboard Trap",
          ruleDescription: "Detects keyboard traps",
          passed: false,
          violations: [
            {
              ruleId: "keyboard-trap",
              ruleName: "Keyboard Trap",
              severity: "error",
              message: "Focus is trapped on element",
              elements: [{ selector: "input.trap", outerHTML: "<input>" }],
              wcag: ["2.1.2"],
              impact: "Users cannot navigate away",
            },
          ],
          wcag: ["2.1.2"],
          duration: 5,
        },
      ],
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("### Keyboard Trap [FAIL]");
    expect(md).toContain("**error**");
    expect(md).toContain("Focus is trapped on element");
    expect(md).toContain("input.trap");
  });

  it("should render passing rules", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "tabindex-abuse",
          ruleName: "Tabindex Abuse",
          passed: true,
          violations: [],
          wcag: ["2.4.3"],
          duration: 2,
        },
      ],
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("### Tabindex Abuse [PASS]");
  });

  it("should render string fix suggestions", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "tabindex-abuse",
          ruleName: "Tabindex Abuse",
          passed: false,
          violations: [
            {
              ruleId: "tabindex-abuse",
              ruleName: "Tabindex Abuse",
              severity: "warning",
              message: "Positive tabindex detected",
              elements: [],
              wcag: ["2.4.3"],
              impact: "Changes natural tab order",
              fixSuggestion: "Remove the tabindex attribute",
            },
          ],
          wcag: ["2.4.3"],
          duration: 1,
        },
      ],
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("**Fix:** Remove the tabindex attribute");
  });

  it("should render structured fix suggestions", async () => {
    const reportMarkdown = await getReportMarkdown();
    const fix: FixSuggestion = {
      summary: "Remove tabindex",
      codeBefore: '<div tabindex="5">',
      codeAfter: '<div tabindex="0">',
      wcagRef: "2.4.3",
      estimatedEffort: "low",
      explanation: "Positive tabindex disrupts natural focus order",
    };
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "tabindex-abuse",
          ruleName: "Tabindex Abuse",
          passed: false,
          violations: [
            {
              ruleId: "tabindex-abuse",
              ruleName: "Tabindex Abuse",
              severity: "warning",
              message: "Positive tabindex",
              elements: [],
              wcag: ["2.4.3"],
              impact: "Disrupts order",
              fixSuggestion: fix,
            },
          ],
          wcag: ["2.4.3"],
          duration: 1,
        },
      ],
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("**Fix:** Remove tabindex");
    expect(md).toContain("Effort: low");
    expect(md).toContain("WCAG: 2.4.3");
    expect(md).toContain("Positive tabindex disrupts natural focus order");
  });

  it("should render AI focus order analysis (structured)", async () => {
    const reportMarkdown = await getReportMarkdown();
    const analysis: AIFocusOrderResult = {
      summary: "Focus order follows a reasonable pattern",
      issues: [
        {
          elementIndex: 3,
          description: "Sidebar link reached before main content",
          severity: "warning",
          suggestion: "Move sidebar after main in DOM",
        },
      ],
      overallAssessment: "acceptable",
    };
    const report = makeAuditReport({ aiFocusOrderAnalysis: analysis });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("## AI Analysis");
    expect(md).toContain("### Focus Order Analysis");
    expect(md).toContain("**Assessment:** acceptable");
    expect(md).toContain("Sidebar link reached before main content");
  });

  it("should render AI focus order analysis (string fallback)", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      aiFocusOrderAnalysis: "The focus order looks reasonable overall.",
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("The focus order looks reasonable overall.");
  });

  it("should render widget classifications", async () => {
    const reportMarkdown = await getReportMarkdown();
    const classifications: WidgetClassification[] = [
      {
        element: {
          selector: "div.dropdown",
          tagName: "div",
          role: "combobox",
          accessibleName: "Category",
          outerHTML: "<div>...</div>",
        },
        pattern: "combobox",
        confidence: 0.92,
        expectedKeyboard: [
          {
            key: "ArrowDown",
            expectedBehavior: "Open list or move to next option",
          },
        ],
      },
    ];
    const report = makeAuditReport({ widgetClassifications: classifications });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("### Widget Classifications");
    expect(md).toContain("combobox");
    expect(md).toContain("92%");
    expect(md).toContain("ArrowDown");
  });

  it("should render accessible name suggestions", async () => {
    const reportMarkdown = await getReportMarkdown();
    const suggestions: AccessibleNameSuggestion[] = [
      {
        element: {
          selector: "button.icon-btn",
          tagName: "button",
          role: "button",
          outerHTML: "<button><svg/></button>",
        },
        suggestedLabel: "Close dialog",
        suggestedRole: "button",
        confidence: 0.85,
        reasoning: "Button contains only an X icon",
      },
    ];
    const report = makeAuditReport({
      accessibleNameSuggestions: suggestions,
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("### Accessible Name Suggestions");
    expect(md).toContain("Close dialog");
    expect(md).toContain("85%");
    expect(md).toContain("Button contains only an X icon");
  });

  it("should render focus indicator scores", async () => {
    const reportMarkdown = await getReportMarkdown();
    const scores: FocusIndicatorScore[] = [
      {
        element: {
          selector: "a.nav-link",
          tagName: "a",
          role: "link",
          accessibleName: "Home",
        },
        score: 8,
        contrast: "sufficient",
        visibility: "clear",
        recommendation: null,
      },
    ];
    const report = makeAuditReport({ focusIndicatorScores: scores });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("### Focus Indicator Scores");
    expect(md).toContain("8/10");
    expect(md).toContain("sufficient");
    expect(md).toContain("clear");
  });

  it("should render structured AI summary", async () => {
    const reportMarkdown = await getReportMarkdown();
    const summary: AIReportSummary = {
      overview: "The page has moderate accessibility issues.",
      criticalIssues: ["Keyboard trap on search input"],
      prioritizedFixes: [
        { fix: "Remove focus trap", effort: "low", impact: "high" },
      ],
      aiSeverityRating: 65,
      recommendation: "Fix the keyboard trap as the top priority.",
    };
    const report = makeAuditReport({ aiSummary: summary });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("### AI Summary");
    expect(md).toContain("moderate accessibility issues");
    expect(md).toContain("Keyboard trap on search input");
    expect(md).toContain("Remove focus trap");
    expect(md).toContain("65/100");
  });

  it("should render string AI summary", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      aiSummary: "Overall the page has decent keyboard support.",
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("Overall the page has decent keyboard support.");
  });

  it("should render footer", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({ version: "0.1.0" });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("Generated by Keylens v0.1.0");
  });

  it("should handle empty report gracefully", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport();

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("# Keylens Keyboard Navigation Report");
    expect(md).toContain("## Summary");
    expect(md).not.toContain("## AI Analysis");
  });

  it("should render focus sequence with ARIA attributes", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      focusSequence: [
        makeFocusedElement({
          tabIndex: 1,
          tagName: "button",
          role: "button",
          accessibleName: "Toggle",
          selector: "button.toggle",
          ariaAttributes: {
            "aria-expanded": "false",
            "aria-controls": "panel",
          },
          parentContext: "nav",
        }),
      ],
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("ARIA Attrs");
    expect(md).toContain("aria-expanded");
    expect(md).toContain("Context");
    expect(md).toContain("nav");
  });
});

describe("reportMultiMarkdown", () => {
  async function getReportMultiMarkdown() {
    const mod = await import("@/reporters/markdown-reporter.js");
    return mod.reportMultiMarkdown;
  }

  it("should create output directory and write multi markdown file", async () => {
    const reportMultiMarkdown = await getReportMultiMarkdown();
    const report = makeMultiPageReport();

    await reportMultiMarkdown(report, "./test-output");

    expect(mockMkdir).toHaveBeenCalledWith("./test-output", {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile.mock.calls[0]![0]).toMatch(
      /keylens-report-multi\.md$/,
    );
  });

  it("should include multi-page header and aggregate summary", async () => {
    const reportMultiMarkdown = await getReportMultiMarkdown();
    const report = makeMultiPageReport({
      urls: ["https://a.com", "https://b.com"],
      pages: [
        makeAuditReport({ url: "https://a.com" }),
        makeAuditReport({ url: "https://b.com" }),
      ],
      summary: {
        totalPages: 2,
        totalErrors: 5,
        totalWarnings: 3,
        totalInfo: 1,
        pagesWithErrors: 2,
        score: 60,
      },
    });

    await reportMultiMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("# Keylens Multi-Page Keyboard Navigation Report");
    expect(md).toContain("## Aggregate Summary");
    expect(md).toContain("| 2 | 5 | 3 | 1 | 0 | 2 | 60/100 |");
  });

  it("should render individual page sections", async () => {
    const reportMultiMarkdown = await getReportMultiMarkdown();
    const report = makeMultiPageReport({
      urls: ["https://a.com", "https://b.com"],
      pages: [
        makeAuditReport({ url: "https://a.com" }),
        makeAuditReport({ url: "https://b.com" }),
      ],
    });

    await reportMultiMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("## Page: https://a.com");
    expect(md).toContain("## Page: https://b.com");
  });

  it("should render cross-page patterns", async () => {
    const reportMultiMarkdown = await getReportMultiMarkdown();
    const patterns: CrossPagePattern[] = [
      {
        type: "inconsistent-order",
        description: "Nav tab order differs between pages",
        affectedPages: ["https://a.com", "https://b.com"],
        severity: "warning",
        suggestion: "Ensure nav elements have consistent DOM order",
      },
    ];
    const report = makeMultiPageReport({ crossPagePatterns: patterns });

    await reportMultiMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("## Cross-Page Patterns");
    expect(md).toContain("inconsistent-order");
    expect(md).toContain("Nav tab order differs between pages");
    expect(md).toContain("https://a.com");
  });

  it("should render multi-page AI summary", async () => {
    const reportMultiMarkdown = await getReportMultiMarkdown();
    const summary: AIReportSummary = {
      overview: "Cross-page analysis shows consistent issues.",
      criticalIssues: ["Missing skip link on /about"],
      prioritizedFixes: [
        { fix: "Add skip link to all pages", effort: "low", impact: "high" },
      ],
      aiSeverityRating: 55,
      recommendation: "Standardize skip link across all pages.",
    };
    const report = makeMultiPageReport({ aiSummary: summary });

    await reportMultiMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("## AI Summary");
    expect(md).toContain("Cross-page analysis shows consistent issues.");
    expect(md).toContain("Missing skip link on /about");
  });

  it("should include footer", async () => {
    const reportMultiMarkdown = await getReportMultiMarkdown();
    const report = makeMultiPageReport();

    await reportMultiMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("Generated by Keylens");
  });
});
