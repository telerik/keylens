import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeAuditReport,
  makeFocusedElement,
} from "@tests/helpers/factories.js";

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
    expect(mockWriteFile.mock.calls[0]![0]).toMatch(
      /keylens-report-[\d-T]+\.md$/,
    );
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

  it("should render dismissed overlays, prepare warnings, and a fast crawl duration", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      crawl: {
        totalFocusableElements: 15,
        totalInteractiveElements: 20,
        unreachedElements: 5,
        cycleCompleted: true,
        duration: 500,
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

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("500ms");
    expect(md).toContain("**Overlays dismissed:** onetrust (reject)");
    expect(md).toContain(
      "**Prepare warnings:** Consent banner selector matched but click timed out",
    );
  });

  it("should render a functional skip link and a failing skip link", async () => {
    const reportMarkdown = await getReportMarkdown();
    const passing = makeAuditReport({
      rules: [
        {
          ruleId: "skip-link",
          ruleName: "Skip Link",
          passed: true,
          violations: [],
          duration: 1,
        },
      ],
    });

    await reportMarkdown(passing, "./test-output");
    const passingMd = getWrittenMarkdown();
    expect(passingMd).toContain("## Skip Link");
    expect(passingMd).toContain("Skip link: **functional.**");

    mockWriteFile.mockClear();

    const failing = makeAuditReport({
      rules: [
        {
          ruleId: "skip-link",
          ruleName: "Skip Link",
          passed: false,
          violations: [
            {
              ruleId: "skip-link",
              ruleName: "Skip Link",
              severity: "error",
              message: "No skip link found",
              elements: [],
              impact: "High",
            },
          ],
          duration: 1,
        },
      ],
    });

    await reportMarkdown(failing, "./test-output");
    const failingMd = getWrittenMarkdown();
    expect(failingMd).toContain("**error**: No skip link found");
  });

  it("should render a rule evaluation error", async () => {
    const reportMarkdown = await getReportMarkdown();
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "broken-rule",
          ruleName: "Broken Rule",
          status: "error",
          passed: false,
          violations: [],
          duration: 5,
          error: { code: "RULE_ERROR", message: "Evaluation failed" },
        },
      ],
    });

    await reportMarkdown(report, "./test-output");
    const md = getWrittenMarkdown();

    expect(md).toContain("**Evaluation error:** Evaluation failed");
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
