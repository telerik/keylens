import { describe, it, expect, vi, afterEach } from "vitest";
import { reportCLI } from "@/reporters/cli-reporter.js";
import {
  makeAuditReport,
  makeFocusedElement,
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

  it("shows interaction case details when interaction evaluation errors", () => {
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "focus-after-interaction",
          status: "error",
          passed: false,
          violations: [],
          duration: 10,
          error: {
            code: "RULE_ERROR",
            message: "1 interaction case(s) could not be evaluated",
          },
        },
      ],
      interactionResults: [
        {
          element: {
            selector: "#stale-button",
            tagName: "button",
            role: "button",
            accessibleName: "Open",
          },
          action: "click",
          focusAfter: null,
          status: "error",
          reason: "element-missing",
          message: "Control no longer exists after page reset: #stale-button",
          duration: 5,
        },
      ],
    });

    reportCLI(report);

    const allErrors = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allErrors).toContain("#stale-button");
    expect(allErrors).toContain("element-missing");
    expect(allErrors).toContain("Control no longer exists");
  });

  it("reports focus screenshot coverage", () => {
    const report = makeAuditReport();
    report.config.capture.elements = true;
    report.crawl.capture = {
      attempted: 5,
      captured: 4,
      skipped: 1,
      failed: 0,
      byteLength: 3072,
      decodedPixels: 100,
    };
    report.assets = [
      {
        id: "focused",
        type: "focused-element-screenshot",
        mediaType: "image/png",
        byteLength: 1024,
        storage: { kind: "inline", data: "a", encoding: "base64" },
      },
      {
        id: "unfocused",
        type: "unfocused-element-screenshot",
        mediaType: "image/png",
        byteLength: 2048,
        storage: { kind: "inline", data: "b", encoding: "base64" },
      },
    ];
    report.focusSequence = [
      makeFocusedElement({
        focusedScreenshotAssetId: "focused",
        unfocusedScreenshotAssetId: "unfocused",
      }),
    ];

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Focus screenshots:");
    expect(allOutput).toContain("1 complete pair(s)");
    expect(allOutput).toContain("3.0 KB");
    expect(allOutput).toContain("Capture omissions:");
    expect(allOutput).toContain(
      "1 skipped, 0 failed across page and focus captures",
    );
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

  it("should show scroll container expansion details when present", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 0,
        totalInteractiveElements: 0,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
        capture: {
          attempted: 0,
          captured: 0,
          skipped: 0,
          failed: 0,
          byteLength: 0,
          decodedPixels: 0,
        },
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

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Scroll container expanded:");
    expect(allOutput).toContain("div.parallax (900px -> 5198px)");
  });

  it("should show dismissed overlays and prepare warnings when present", () => {
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 0,
        totalInteractiveElements: 0,
        unreachedElements: 0,
        cycleCompleted: true,
        duration: 1000,
        capture: {
          attempted: 0,
          captured: 0,
          skipped: 0,
          failed: 0,
          byteLength: 0,
          decodedPixels: 0,
        },
        prepare: {
          attempted: true,
          dismissals: [
            { provider: "onetrust", action: "reject", verified: true },
          ],
          warnings: ["Consent banner selector matched but click timed out"],
          duration: 50,
        },
      },
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Overlays dismissed:");
    expect(allOutput).toContain("onetrust (reject)");
    expect(allOutput).toContain("Prepare warnings:");
    expect(allOutput).toContain(
      "Consent banner selector matched but click timed out",
    );
  });

  it("formats byte counts below 1 KB and at MB scale", () => {
    const smallReport = makeAuditReport();
    smallReport.config.capture.elements = true;
    smallReport.crawl.capture = {
      attempted: 1,
      captured: 1,
      skipped: 0,
      failed: 0,
      byteLength: 300,
      decodedPixels: 10,
    };
    smallReport.assets = [
      {
        id: "focused",
        type: "focused-element-screenshot",
        mediaType: "image/png",
        byteLength: 300,
        storage: { kind: "inline", data: "a", encoding: "base64" },
      },
    ];
    smallReport.focusSequence = [
      makeFocusedElement({ focusedScreenshotAssetId: "focused" }),
    ];

    reportCLI(smallReport);
    const smallOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(smallOutput).toContain("300 B");

    logSpy.mockClear();

    const largeReport = makeAuditReport();
    largeReport.config.capture.elements = true;
    largeReport.crawl.capture = {
      attempted: 1,
      captured: 1,
      skipped: 0,
      failed: 0,
      byteLength: 2 * 1024 * 1024,
      decodedPixels: 10,
    };
    largeReport.assets = [
      {
        id: "focused",
        type: "focused-element-screenshot",
        mediaType: "image/png",
        byteLength: 2 * 1024 * 1024,
        storage: { kind: "inline", data: "b", encoding: "base64" },
      },
    ];
    largeReport.focusSequence = [
      makeFocusedElement({ focusedScreenshotAssetId: "focused" }),
    ];

    reportCLI(largeReport);
    const largeOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(largeOutput).toContain("2.0 MB");
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
