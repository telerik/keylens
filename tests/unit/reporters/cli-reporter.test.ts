import { describe, it, expect, vi, afterEach } from "vitest";
import { reportCLI, reportMultiCLI } from "@/reporters/cli-reporter.js";
import {
  makeAuditReport,
  makeMultiPageReport,
} from "@tests/helpers/factories.js";
import { setLogLevel } from "@/utils/logger.js";
import type {
  RuleResult,
  AIReportSummary,
  FixSuggestion,
  AIFocusOrderResult,
} from "@/types/index.js";

describe("CLI Reporter", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    logSpy.mockClear();
    errorSpy.mockClear();
    setLogLevel("info");
  });

  it("should output the URL", () => {
    const report = makeAuditReport({ url: "https://test.example.com" });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("https://test.example.com");
  });

  it("should output focusable and interactive element counts", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 15,
        totalInteractiveElements: 20,
        unreachedElements: 3,
        cycleCompleted: true,
        duration: 500,
      },
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("15");
    expect(allOutput).toContain("20");
  });

  it("should show passed rules with checkmark", () => {
    const passedRule: RuleResult = {
      ruleId: "test-rule",
      passed: true,
      violations: [],
      duration: 10,
    };
    const report = makeAuditReport({ rules: [passedRule] });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("test-rule");
  });

  it("should show failed rules with violation count", () => {
    const failedRule: RuleResult = {
      ruleId: "bad-rule",
      passed: false,
      violations: [
        {
          ruleId: "bad-rule",
          ruleName: "Bad Rule",
          severity: "error",
          message: "Something is wrong",
          elements: [
            { selector: "button.bad", outerHTML: "<button>Bad</button>" },
          ],
          impact: "High",
        },
      ],
      duration: 10,
    };
    const report = makeAuditReport({ rules: [failedRule] });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("bad-rule");
    expect(allOutput).toContain("Something is wrong");
    expect(allOutput).toContain("button.bad");
  });

  it("should not report success when a rule evaluation errored", () => {
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "broken-rule",
          status: "error",
          passed: false,
          violations: [],
          duration: 10,
          error: { code: "RULE_ERROR", message: "Evaluation failed" },
        },
      ],
      summary: {
        totalRules: 1,
        passed: 0,
        failed: 0,
        errors: 1,
        totalErrors: 0,
        totalWarnings: 0,
        score: 0,
        scoreComplete: false,
      },
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Audit incomplete");
    expect(allOutput).not.toContain("All checks passed!");
  });

  it("should truncate elements to 5 and show overflow count", () => {
    const elements = Array.from({ length: 8 }, (_, i) => ({
      selector: `el-${i}`,
      outerHTML: `<div>${i}</div>`,
    }));
    const failedRule: RuleResult = {
      ruleId: "many-elements",
      passed: false,
      violations: [
        {
          ruleId: "many-elements",
          ruleName: "Many Elements",
          severity: "warning",
          message: "Too many issues",
          elements,
          impact: "Medium",
        },
      ],
      duration: 10,
    };
    const report = makeAuditReport({ rules: [failedRule] });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("el-0");
    expect(allOutput).toContain("el-4");
    expect(allOutput).not.toContain("el-5");
    expect(allOutput).toContain("3 more");
  });

  it("should show AI fix suggestion when present", () => {
    const failedRule: RuleResult = {
      ruleId: "fix-me",
      passed: false,
      violations: [
        {
          ruleId: "fix-me",
          ruleName: "Fix Me",
          severity: "warning",
          message: "Needs fixing",
          elements: [],
          impact: "Medium",
          fixSuggestion: "Add aria-label to the button",
        },
      ],
      duration: 10,
    };
    const report = makeAuditReport({ rules: [failedRule] });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Add aria-label to the button");
  });

  it("should show AI summary when present", () => {
    const report = makeAuditReport({
      aiSummary: "This page has critical accessibility issues.",
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("This page has critical accessibility issues.");
  });

  it("should not show AI summary when absent", () => {
    const report = makeAuditReport({ aiSummary: undefined });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).not.toContain("AI Summary");
  });

  it("should render structured FixSuggestion with before/after code", () => {
    const fix: FixSuggestion = {
      summary: "Add outline style to button",
      codeBefore: "outline: none;",
      codeAfter: "outline: 2px solid blue;",
      wcagRef: "2.4.7",
      estimatedEffort: "low",
      explanation: "Removing outline suppresses the focus indicator.",
    };
    const failedRule: RuleResult = {
      ruleId: "fix-structured",
      passed: false,
      violations: [
        {
          ruleId: "fix-structured",
          ruleName: "Fix Structured",
          severity: "warning",
          message: "Missing focus style",
          elements: [],
          impact: "Medium",
          fixSuggestion: fix,
        },
      ],
      duration: 10,
    };
    const report = makeAuditReport({ rules: [failedRule] });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Add outline style to button");
    expect(allOutput).toContain("outline: none;");
    expect(allOutput).toContain("outline: 2px solid blue;");
    expect(allOutput).toContain("low");
    expect(allOutput).toContain(
      "Removing outline suppresses the focus indicator.",
    );
  });

  it("should render structured AIReportSummary", () => {
    const aiSummary: AIReportSummary = {
      overview: "The page has significant keyboard issues.",
      criticalIssues: ["Keyboard trap in modal dialog"],
      prioritizedFixes: [
        { fix: "Add escape key handler", effort: "low", impact: "high" },
      ],
      aiSeverityRating: 45,
      recommendation: "Address the keyboard trap first.",
    };
    const report = makeAuditReport({ aiSummary });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("The page has significant keyboard issues.");
    expect(allOutput).toContain("Keyboard trap in modal dialog");
    expect(allOutput).toContain("Add escape key handler");
    expect(allOutput).toContain("45");
    expect(allOutput).toContain("Address the keyboard trap first.");
  });

  it("should render structured AIFocusOrderResult", () => {
    const analysis: AIFocusOrderResult = {
      summary: "Focus order is mostly logical.",
      issues: [
        {
          elementIndex: 3,
          description: "Sidebar focused before main content",
          severity: "warning",
          suggestion: "Move sidebar after main in DOM",
        },
      ],
      overallAssessment: "acceptable",
    };
    const report = makeAuditReport({ aiFocusOrderAnalysis: analysis });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("acceptable");
    expect(allOutput).toContain("Focus order is mostly logical.");
    expect(allOutput).toContain("Sidebar focused before main content");
    expect(allOutput).toContain("Move sidebar after main in DOM");
  });

  it("should render widget classifications", () => {
    const report = makeAuditReport({
      widgetClassifications: [
        {
          element: {
            selector: "div.accordion",
            tagName: "div",
            role: "region",
            accessibleName: "FAQ",
            outerHTML: "<div>FAQ</div>",
          },
          pattern: "accordion",
          confidence: 0.92,
          expectedKeyboard: [
            { key: "Enter", expectedBehavior: "Toggle section" },
          ],
        },
      ],
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("accordion");
    expect(allOutput).toContain("92%");
    expect(allOutput).toContain("Toggle section");
  });

  it("should render accessible name suggestions", () => {
    const report = makeAuditReport({
      accessibleNameSuggestions: [
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
          reasoning: "Button contains only an icon with no text.",
        },
      ],
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("button.icon-btn");
    expect(allOutput).toContain("Close dialog");
    expect(allOutput).toContain("85%");
    expect(allOutput).toContain("Button contains only an icon with no text.");
  });

  it("should render focus indicator quality scores", () => {
    const report = makeAuditReport({
      focusIndicatorScores: [
        {
          element: {
            selector: "a.nav-link",
            tagName: "a",
            role: "link",
            accessibleName: "Home",
          },
          score: 3,
          contrast: "very-low",
          visibility: "nearly-invisible",
          recommendation: "Use a thicker, higher-contrast outline.",
        },
      ],
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("a.nav-link");
    expect(allOutput).toContain("3/10");
    expect(allOutput).toContain("very-low");
    expect(allOutput).toContain("nearly-invisible");
    expect(allOutput).toContain("Use a thicker, higher-contrast outline.");
  });
});

describe("reportMultiCLI", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  afterEach(() => {
    logSpy.mockClear();
  });

  it("should output all page URLs", () => {
    const report = makeMultiPageReport({
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
    });

    reportMultiCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("https://a.com");
    expect(allOutput).toContain("https://b.com");
  });

  it("should show aggregate summary", () => {
    const report = makeMultiPageReport({
      summary: {
        totalPages: 3,
        totalErrors: 5,
        totalWarnings: 2,
        totalInfo: 0,
        pagesWithErrors: 2,
      },
    });

    reportMultiCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Multi-Page Summary");
    expect(allOutput).toContain("3");
    expect(allOutput).toContain("5");
    expect(allOutput).toContain("2");
  });

  it("should show cross-page patterns", () => {
    const report = makeMultiPageReport({
      crossPagePatterns: [
        {
          type: "inconsistent-order",
          description: "Navigation order differs between pages",
          affectedPages: ["https://a.com/page1", "https://a.com/page2"],
          severity: "warning",
          suggestion: "Ensure consistent tab order across pages.",
        },
      ],
    });

    reportMultiCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Cross-Page Patterns");
    expect(allOutput).toContain("inconsistent-order");
    expect(allOutput).toContain("Navigation order differs between pages");
    expect(allOutput).toContain("Ensure consistent tab order across pages.");
  });

  it("should show multi-page AI summary", () => {
    const report = makeMultiPageReport({
      aiSummary: "Overall the site has good keyboard support.",
    });

    reportMultiCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Overall the site has good keyboard support.");
  });

  it("should render structured AI summary in multi-page report", () => {
    const aiSummary: AIReportSummary = {
      overview: "Multi-page assessment shows inconsistent patterns.",
      criticalIssues: ["Skip link missing on 2 of 3 pages"],
      prioritizedFixes: [
        { fix: "Add skip links everywhere", effort: "low", impact: "high" },
      ],
      aiSeverityRating: 62,
      recommendation: "Standardize skip links across all pages.",
    };
    const report = makeMultiPageReport({ aiSummary });

    reportMultiCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain(
      "Multi-page assessment shows inconsistent patterns.",
    );
    expect(allOutput).toContain("Skip link missing on 2 of 3 pages");
    expect(allOutput).toContain("62");
    expect(allOutput).toContain("Standardize skip links across all pages.");
  });
});
