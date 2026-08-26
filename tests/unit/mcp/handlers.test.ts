import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import {
  buildConfig,
  compactReport,
  handleAudit,
  handleGetRuleGuidance,
} from "@/mcp/handlers.js";
import {
  makeAuditReport,
  makeFocusedElement,
  makeFocusStyleSnapshot,
} from "@tests/helpers/factories.js";
import type { AuditReport } from "@/types/index.js";

// ─── Mocks ──────────────────────────────────────────────────────

const mockAudit =
  vi.fn<(url: string, config: unknown) => Promise<AuditReport>>();
const mockRenderAuditReport = vi.fn().mockResolvedValue(undefined);

vi.mock("@/index.js", async () => {
  const guidance =
    await vi.importActual<typeof import("@/guidance.js")>("@/guidance.js");
  return {
    audit: (...args: unknown[]) => mockAudit(...(args as [string, unknown])),
    renderAuditReport: (...args: unknown[]) => mockRenderAuditReport(...args),
    getRuleCatalog: guidance.getRuleCatalog,
    getRuleRemediation: guidance.getRuleRemediation,
    DEFAULT_CONFIG: {
      url: undefined,
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
      headed: false,
      capture: {
        page: "none",
        limits: {
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
    },
  };
});

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
      interactions: true,
    });

    expect(config.browser).toBe("firefox");
    expect(config.maxTabs).toBe(100);
    expect(config.viewport).toEqual({ width: 800, height: 600 });
    expect(config.interactions.enabled).toBe(true);
  });

  it("does not leak capture mutations between requests", () => {
    const visual = buildConfig();
    visual.capture.page = "full";
    const next = buildConfig();

    expect(next.capture).toEqual(expect.objectContaining({ page: "none" }));
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
    });

    const compact = compactReport(report);

    expect(compact.url).toBe("https://example.com");
    expect(compact.summary.totalErrors).toBe(2);
    expect(compact.focusSequence![0]!.selector).toBe("button.save");
    expect(compact.focusSequence![0]!.role).toBe("button");
    expect(compact.focusSequence![0]!.accessibleName).toBe("Save");
  });
});

describe("handleAudit", () => {
  beforeEach(() => {
    mockAudit.mockReset();
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

  it("forwards prepare and report options to the audit config", async () => {
    mockAudit.mockResolvedValue(makeAuditReport());

    await handleAudit({
      url: "https://test.com",
      options: {
        profile: "fast",
        viewport: { width: 800 },
        tabDelay: 20,
        waitForSelector: "#ready",
        waitAfterLoad: 100,
        interactions: true,
        keepOverlays: true,
        dismissSelectors: ["#close"],
        reporters: ["json"],
        outputDir: "./reports",
      },
    });

    const config = mockAudit.mock.calls[0]![1] as {
      profile: string;
      viewport: { width: number; height: number };
      tabDelay: number;
      waitForSelector: string;
      waitAfterLoad: number;
      interactions: { enabled: boolean };
      prepare: { dismissOverlays: boolean; dismissSelectors: string[] };
      reporters: string[];
      outputDir: string;
    };
    expect(config.profile).toBe("fast");
    expect(config.viewport).toEqual({ width: 800, height: 720 });
    expect(config.tabDelay).toBe(20);
    expect(config.waitForSelector).toBe("#ready");
    expect(config.waitAfterLoad).toBe(100);
    expect(config.interactions.enabled).toBe(true);
    expect(config.prepare).toEqual(
      expect.objectContaining({
        dismissOverlays: false,
        dismissSelectors: ["#close"],
      }),
    );
    expect(config.reporters).toEqual(["json"]);
    expect(config.outputDir).toBe("./reports");
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

describe("handleGetRuleGuidance", () => {
  it("lists all rules with their config key when ruleId is omitted", () => {
    const result = handleGetRuleGuidance({});
    const rules = JSON.parse(result.content[0]!.text) as Array<{
      ruleId: string;
      configKey: string;
    }>;

    expect(rules.length).toBeGreaterThan(0);
    expect(result.isError).toBeUndefined();
    expect(rules).toContainEqual(
      expect.objectContaining({
        ruleId: "missing-focus-indicator",
        configKey: "missingFocusIndicator",
      }),
    );
  });

  it("returns a single rule's guidance when ruleId matches", () => {
    const result = handleGetRuleGuidance({ ruleId: "keyboard-trap" });
    const rule = JSON.parse(result.content[0]!.text) as {
      ruleId: string;
      configKey: string;
      wcag: unknown[];
    };

    expect(rule.ruleId).toBe("keyboard-trap");
    expect(rule.configKey).toBe("keyboardTrap");
    expect(rule.wcag.length).toBeGreaterThan(0);
    expect(result.isError).toBeUndefined();
  });

  it("returns an error for an unknown ruleId", () => {
    const result = handleGetRuleGuidance({ ruleId: "not-a-real-rule" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Unknown rule");
    expect(result.content[0]!.text).toContain("keyboard-trap");
  });
});
