import { describe, it, expect, vi, afterEach } from "vitest";
import {
  printSavedReports,
  renderScoreBar,
  reportCLI,
  reportCLISummary,
  shortenPath,
} from "@/reporters/cli-reporter.js";
import { makeAuditReport } from "@tests/helpers/factories.js";
import { setLogLevel } from "@/utils/logger.js";
import type { RuleResult } from "@/types/index.js";

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
    expect(allOutput).toContain("<button>Bad</button>");
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

  it("reports capture omissions when the page screenshot was skipped or failed", () => {
    const report = makeAuditReport();
    report.crawl.capture = {
      attempted: 1,
      captured: 0,
      skipped: 1,
      failed: 0,
      byteLength: 0,
      decodedPixels: 0,
    };

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("Capture omissions:");
    expect(allOutput).toContain("1 skipped, 0 failed");
  });

  it("should list every affected element without truncation", () => {
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
    expect(allOutput).toContain("<div>0</div>");
    expect(allOutput).toContain("<div>7</div>");
    expect(allOutput).not.toContain("more");
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
  it("summarizes failing rules by severity and lists top fixes from the guidance catalog", () => {
    const element = { selector: "a.nav", outerHTML: "<a>Nav</a>" };
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "keyboard-trap",
          passed: true,
          violations: [],
          duration: 1,
        },
        {
          ruleId: "focus-order-mismatch",
          passed: false,
          violations: [
            {
              ruleId: "focus-order-mismatch",
              ruleName: "Focus Order",
              severity: "warning",
              message: "Out of order",
              elements: [element],
              impact: "Medium",
            },
          ],
          duration: 1,
        },
        {
          ruleId: "unreachable-elements",
          passed: false,
          violations: ["a", "b"].map((id) => ({
            ruleId: "unreachable-elements",
            ruleName: "Unreachable",
            severity: "error" as const,
            message: `Unreachable ${id}`,
            elements: [element],
            impact: "High",
          })),
          duration: 1,
        },
      ],
    });

    reportCLI(report);

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toMatch(/unreachable-elements\s.*2 errors/);
    expect(allOutput).toMatch(/focus-order-mismatch\s.*1 warning/);
    const topFixes = allOutput.slice(allOutput.indexOf("Top fixes"));
    expect(topFixes.indexOf("(unreachable-elements)")).toBeLessThan(
      topFixes.indexOf("(focus-order-mismatch)"),
    );
    expect(topFixes).not.toContain("(keyboard-trap)");
  });

  it("fills the score bar proportionally and clamps out-of-range scores", () => {
    const filled = (score: number) =>
      [...renderScoreBar(score)].filter((char) => char === "█").length;
    expect(filled(0)).toBe(0);
    expect(filled(50)).toBe(12);
    expect(filled(100)).toBe(24);
    expect(filled(150)).toBe(24);
  });

  it("summary omits issue details and hints at -o cli when rules fail", () => {
    const report = makeAuditReport({
      rules: [
        {
          ruleId: "bad-rule",
          passed: false,
          violations: [
            {
              ruleId: "bad-rule",
              ruleName: "Bad Rule",
              severity: "error",
              message: "Something is wrong",
              elements: [{ selector: "a", outerHTML: "<a>Bad</a>" }],
              impact: "High",
            },
          ],
          duration: 1,
        },
      ],
    });

    reportCLISummary(report, { hintFullReport: true });

    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allOutput).toContain("bad-rule");
    expect(allOutput).not.toContain("<a>Bad</a>");
    expect(allOutput).toContain("-o cli");
  });

  describe("saved reports", () => {
    it("shortens paths relative to cwd, else to ~", () => {
      expect(
        shortenPath("/work/app/keylens-report/r.html", "/work/app", "/home/me"),
      ).toBe("keylens-report/r.html");
      expect(shortenPath("/home/me/out/r.json", "/work/app", "/home/me")).toBe(
        "~/out/r.json",
      );
      expect(shortenPath("/tmp/r.md", "/work/app", "/home/me")).toBe(
        "/tmp/r.md",
      );
    });

    it("lists each report with a clickable file:// link", () => {
      const path = `${process.cwd()}/keylens-report/r.html`;
      printSavedReports([{ type: "html", path }], { links: true });

      const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(allOutput).toContain("Reports saved");
      expect(allOutput).toContain("keylens-report/r.html");
      expect(allOutput).toContain(`\u001B]8;;file://${path}\u0007`);
    });

    it("omits links when disabled", () => {
      printSavedReports([{ type: "json", path: `${process.cwd()}/r.json` }], {
        links: false,
      });

      const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(allOutput).toContain("r.json");
      expect(allOutput).not.toContain("\u001B]8;;");
    });
  });
});
