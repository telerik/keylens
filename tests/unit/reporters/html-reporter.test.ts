import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeAuditReport,
  makeFocusedElement,
  makeInlineAsset,
  makeInteractiveElement,
} from "@tests/helpers/factories.js";
import type {
  RuleResult,
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

  it("should render scroll container expansion details when present", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        crawl: {
          totalFocusableElements: 0,
          totalInteractiveElements: 0,
          unreachedElements: 0,
          cycleCompleted: true,
          duration: 1000,
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
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("Scroll container expanded:");
    expect(html).toContain("div.parallax (900px &rarr; 5198px)");
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
    expect(html).toMatch(
      /Errors<\/div>\s*<div class="value" style="color: var\(--klr-error-on-bg\)">2<\/div>/,
    );
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
    expect(html).toMatch(
      /Warnings<\/div>\s*<div class="value" style="color: var\(--klr-warning-on-bg\)">3<\/div>/,
    );
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
    expect(html).toMatch(
      /Errors<\/div>\s*<div class="value" style="color: var\(--klr-success-on-bg\)">0<\/div>/,
    );
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

  it("should wire an issue instance to its focus-map marker via data-marker-target", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "focus-order-mismatch",
      passed: false,
      violations: [
        {
          ruleId: "focus-order-mismatch",
          ruleName: "Focus Order Mismatch",
          severity: "warning",
          message: "1 element(s) have mismatched focus order.",
          elements: [
            { selector: "a.first", outerHTML: "<a>first</a>", tabPosition: 3 },
          ],
          impact: "Medium",
        },
      ],
      duration: 5,
    };
    await reportHTML(
      makeAuditReport({
        rules: [rule],
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.zero" }),
          makeFocusedElement({ tabIndex: 2, selector: "a.mid" }),
          makeFocusedElement({ tabIndex: 3, selector: "a.first" }),
        ],
        pageDimensions: { width: 1280, height: 720 },
        assets: [makeInlineAsset("shot", "screenshot-data")],
        pageScreenshotAssetId: "shot",
      }),
      "./out",
    );

    const html = getWrittenHTML();
    // The issue instance points at the marker id the reverse-lookup click handler jumps to.
    expect(html).toContain('data-marker-target="marker-3"');
    expect(html).toContain('id="marker-3"');
    expect(html).toContain('data-selector="a.first"');
  });

  it("should leave data-marker-target empty for violations never reached via Tab", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "skip-link",
      passed: false,
      violations: [
        {
          ruleId: "skip-link",
          ruleName: "Skip Link",
          severity: "error",
          message: "No skip link found.",
          elements: [],
          impact: "High",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).toContain('data-marker-target=""');
  });

  it("should render a collapsed accordion with a paginated issue viewer for violations", async () => {
    const reportHTML = await getReportHTML();
    const elements = Array.from({ length: 5 }, (_, i) => ({
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
          message: "5 elements found.",
          elements,
          impact: "Medium",
        },
      ],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    // Rule body is collapsed by default behind a toggle button.
    expect(html).toContain("data-rule-toggle");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("rule-body");
    // Pager shows the total count and full navigation controls.
    expect(html).toContain("<span data-pager-total>5</span>");
    expect(html).toContain('data-pager-action="first"');
    expect(html).toContain('data-pager-action="prev"');
    expect(html).toContain('data-pager-action="next"');
    expect(html).toContain('data-pager-action="last"');
    expect(html).toContain('data-pager-action="highlight"');
    // All instances are present in the markup; only the first starts active.
    expect(html).toContain('issue-instance active" data-instance-index="0"');
    expect(html).toContain('data-instance-index="4"');
    expect(html).toContain("div.el-0");
    expect(html).toContain("div.el-4");
    // The Copy selector button was removed.
    expect(html).not.toContain("Copy selector");
    expect(html).not.toContain('data-pager-action="copy"');
  });

  it("should not render an accordion toggle for a rule with no violations", async () => {
    const reportHTML = await getReportHTML();
    const rule: RuleResult = {
      ruleId: "clean-rule",
      passed: true,
      violations: [],
      duration: 5,
    };
    await reportHTML(makeAuditReport({ rules: [rule] }), "./out");

    const html = getWrittenHTML();
    expect(html).not.toContain("data-rule-toggle aria-expanded");
    expect(html).not.toContain('class="issue-viewer" data-issue-viewer');
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
    expect(html).not.toContain('<script>alert("xss")</script>');
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

  it("should render a plain-string AI focus order analysis", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        aiFocusOrderAnalysis: "Focus order looks fine overall.",
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("AI Focus Order Analysis");
    expect(html).toContain("Focus order looks fine overall.");
  });

  it("should mark an overlay dismissal as unverified when not confirmed hidden", async () => {
    const reportHTML = await getReportHTML();
    await reportHTML(
      makeAuditReport({
        crawl: {
          totalFocusableElements: 0,
          totalInteractiveElements: 0,
          unreachedElements: 0,
          cycleCompleted: true,
          duration: 1000,
          prepare: {
            attempted: true,
            dismissals: [
              {
                provider: "heuristic",
                action: "dismiss",
                selector: "#cookie-banner",
                verified: false,
              },
            ],
            warnings: [],
            duration: 50,
          },
        },
      }),
      "./out",
    );

    const html = getWrittenHTML();
    expect(html).toContain("heuristic (dismiss, unverified)");
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
    // Marker should show index 1 followed by its tooltip.
    expect(result).toContain('>1<div class="focus-tooltip">');
  });

  it("should render SVG connecting lines with a midpoint arrow between markers", async () => {
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

    expect(result).toContain('class="route-outline"');
    expect(result).toContain('class="route"');
    expect(result).toContain('class="route-arrow"');
    expect(result).toContain("focus-lines");
  });

  it("should flag a violating stop's marker with a distinct class and role", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.bad",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const violationsBySelector = new Map([
      ["button.bad", [{ ruleName: "Skip Link", severity: "warning" as const }]],
    ]);
    const result = buildFocusMapHTML(
      [el],
      "data",
      { width: 1280, height: 720 },
      violationsBySelector,
    );

    expect(result).toContain('class="focus-marker focus-marker--violation"');
    expect(result).toContain('role="button"');
  });

  it("should flag an error-severity stop's marker with an additional error class", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.bad",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const violationsBySelector = new Map([
      [
        "button.bad",
        [{ ruleName: "Keyboard Trap", severity: "error" as const }],
      ],
    ]);
    const result = buildFocusMapHTML(
      [el],
      "data",
      { width: 1280, height: 720 },
      violationsBySelector,
    );

    expect(result).toContain(
      'class="focus-marker focus-marker--violation focus-marker--violation-error"',
    );
    expect(result).toContain('role="button"');
  });

  it("should list each violated rule's name as a badge in the marker's tooltip", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.bad",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const violationsBySelector = new Map([
      [
        "button.bad",
        [
          { ruleName: "Skip Link", severity: "warning" as const },
          { ruleName: "Keyboard Trap", severity: "error" as const },
        ],
      ],
    ]);
    const result = buildFocusMapHTML(
      [el],
      "data",
      { width: 1280, height: 720 },
      violationsBySelector,
    );

    expect(result).toContain(">Issues<");
    expect(result).toContain("Skip Link");
    expect(result).toContain("Keyboard Trap");
    expect(result).toContain("focus-tooltip-value--badges");
  });

  it("should label a single issue as 'Issue' (singular) in the tooltip", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.bad",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const violationsBySelector = new Map([
      ["button.bad", [{ ruleName: "Skip Link", severity: "warning" as const }]],
    ]);
    const result = buildFocusMapHTML(
      [el],
      "data",
      { width: 1280, height: 720 },
      violationsBySelector,
    );

    expect(result).toContain(">Issue<");
    expect(result).not.toContain(">Issues<");
  });

  it("should color only the dot (not the connectors/arrows) when a stop has a violation", async () => {
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
    const dims = { width: 1280, height: 720 };

    const withViolation = buildFocusMapHTML(
      [el1, el2],
      "data",
      dims,
      new Map([
        ["a.two", [{ ruleName: "Skip Link", severity: "warning" as const }]],
      ]),
    );
    const withoutViolation = buildFocusMapHTML([el1, el2], "data", dims);

    // Route/arrow markup is identical whether or not a stop has a violation.
    expect(withViolation).toContain('class="route-outline"');
    expect(withViolation).toContain('class="route"');
    expect(withViolation).toContain('class="route-arrow"');
    expect(withViolation).not.toContain("route violation");
    expect(withViolation).not.toContain("route-arrow violation");
    // Only the marker for the violating stop is flagged.
    expect(withViolation).toContain("focus-marker focus-marker--violation");
    expect(withoutViolation).not.toContain("focus-marker--violation");
  });

  it("should place exactly one arrow at each segment's midpoint, not at the stop", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el1 = makeFocusedElement({
      tabIndex: 1,
      selector: "a.top",
      boundingRect: { x: 0, y: 0, width: 20, height: 20 },
    });
    const el2 = makeFocusedElement({
      tabIndex: 2,
      selector: "a.bottom",
      boundingRect: { x: 1200, y: 2000, width: 20, height: 20 },
    });

    const result = buildFocusMapHTML([el1, el2], "data", {
      width: 1280,
      height: 2100,
    });

    const arrowCount = (result.match(/route-arrow/g) ?? []).length;
    expect(arrowCount).toBe(1);

    // p1 center = (10, 10) -> (0.781%, 0.476%); p2 center = (1210, 2010) -> (94.531%, 95.714%)
    // midpoint should sit roughly halfway between them, not at either stop.
    const midXPct = (0.78125 + 94.53125) / 2;
    const midYPct = (0.47619 + 95.71429) / 2;
    expect(result).toContain(`left:${midXPct.toFixed(3)}%`);
    expect(result).toContain(`top:${midYPct.toFixed(3)}%`);
  });

  it("should give each marker a stable id, tabindex, and selector for click targeting", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.one",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const result = buildFocusMapHTML([el], "data", {
      width: 1280,
      height: 720,
    });

    expect(result).toContain('id="marker-1"');
    expect(result).toContain('tabindex="0"');
    expect(result).toContain('data-selector="button.one"');
  });

  it("should prefix marker ids with idPrefix for multi-page id uniqueness", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "button.one",
      boundingRect: { x: 100, y: 50, width: 80, height: 30 },
    });

    const result = buildFocusMapHTML(
      [el],
      "data",
      { width: 1280, height: 720 },
      undefined,
      "page-0-",
    );

    expect(result).toContain('id="page-0-marker-1"');
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

  it("should render each stop as its own plain marker even when several share the same rect (e.g. inside an iframe)", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const iframeRect = { x: 100, y: 100, width: 40, height: 40 };
    const elements = [
      makeFocusedElement({
        tabIndex: 1,
        selector: "iframe-inner.one",
        boundingRect: iframeRect,
      }),
      makeFocusedElement({
        tabIndex: 2,
        selector: "iframe-inner.two",
        boundingRect: iframeRect,
      }),
      makeFocusedElement({
        tabIndex: 3,
        selector: "iframe-inner.three",
        boundingRect: iframeRect,
      }),
    ];

    const result = buildFocusMapHTML(elements, "data", {
      width: 1280,
      height: 720,
    });

    expect(result).toContain('id="marker-1"');
    expect(result).toContain('id="marker-2"');
    expect(result).toContain('id="marker-3"');
    expect(result).toContain('data-selector="iframe-inner.one"');
    expect(result).toContain('data-selector="iframe-inner.two"');
    expect(result).toContain('data-selector="iframe-inner.three"');
  });

  it("should render dashed satellite markers + tooltips for roving-tabindex members only reachable via arrow keys", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const activeEl = makeFocusedElement({
      tabIndex: 1,
      selector: "#tab-1",
      boundingRect: { x: 0, y: 0, width: 50, height: 30 },
    });
    const satelliteMember = makeInteractiveElement({
      selector: "#tab-2",
      role: "tab",
      accessibleName: "Tab Two",
    });

    const result = buildFocusMapHTML(
      [activeEl],
      "data",
      { width: 1280, height: 720 },
      undefined,
      "",
      [
        {
          containerSelector: "#tablist",
          containerRole: "tablist",
          totalMembers: 2,
          reachedViaArrowKeys: [
            {
              selector: "#tab-1",
              pageRect: { x: 0, y: 0, width: 50, height: 30 },
            },
            {
              selector: "#tab-2",
              pageRect: { x: 60, y: 0, width: 50, height: 30 },
            },
          ],
          unreachedViaArrowKeys: [],
        },
      ],
      [satelliteMember],
    );

    expect(result).toContain('class="focus-marker focus-marker--roving"');
    expect(result).toContain('data-selector="#tab-2"');
    expect(result).toContain("via arrow keys");
    expect(result).toContain("Tab Two");
    expect(result).toContain("tablist");
    expect(result).toContain("Tab stop #1");
  });

  it("should skip a roving-tabindex group with no reached members or a single reached member", async () => {
    const buildFocusMapHTML = await getBuildFocusMapHTML();
    const el = makeFocusedElement({
      tabIndex: 1,
      selector: "#tab-1",
      boundingRect: { x: 0, y: 0, width: 50, height: 30 },
    });

    const result = buildFocusMapHTML(
      [el],
      "data",
      { width: 1280, height: 720 },
      undefined,
      "",
      [
        {
          containerSelector: "#tablist",
          containerRole: "tablist",
          totalMembers: 1,
          reachedViaArrowKeys: [],
          unreachedViaArrowKeys: ["#tab-1"],
        },
      ],
      [],
    );

    expect(result).not.toContain("focus-marker--roving");
  });
});
