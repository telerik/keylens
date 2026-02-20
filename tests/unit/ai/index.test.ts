import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIConfig, RuleViolation } from "@/types/index.js";
import {
  makeAuditReport,
  makeFocusedElement,
  makeInteractiveElement,
  makeMultiPageReport,
} from "@tests/helpers/factories.js";

// Mock the logger to suppress output during tests
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

// Mock screenshot annotator to avoid PNG processing in unit tests
vi.mock("@/utils/screenshot-annotator.js", () => ({
  annotateFocusOrder: vi.fn().mockReturnValue("annotated-base64"),
}));

import { logger } from "@/utils/logger.js";
const mockLogger = vi.mocked(logger);

function makeAIConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
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
    ...overrides,
  };
}

describe("AIAnalyzer", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear AI-related env vars
    delete process.env.KEYLENS_AI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Fresh import to avoid cached state
  async function createAnalyzer(config: AIConfig) {
    // Clear module cache to get a fresh AIAnalyzer each time
    vi.resetModules();
    const mod = await import("@/ai/index.js");
    return new mod.AIAnalyzer(config);
  }

  describe("isAvailable", () => {
    it("should return true when enabled and apiKey is set", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({ enabled: true, apiKey: "sk-test-key" }),
      );

      expect(ai.isAvailable()).toBe(true);
    });

    it("should return false when enabled but no apiKey", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: true }));

      expect(ai.isAvailable()).toBe(false);
    });

    it("should return true when enabled with transport but no apiKey", async () => {
      const transport = {
        query: vi.fn(),
        queryVision: vi.fn(),
      };
      const ai = await createAnalyzer(
        makeAIConfig({ enabled: true, transport }),
      );

      expect(ai.isAvailable()).toBe(true);
    });

    it("should return false when disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({ enabled: false, apiKey: "sk-test-key" }),
      );

      expect(ai.isAvailable()).toBe(false);
    });
  });

  describe("API key resolution", () => {
    it("should use config apiKey first", async () => {
      process.env.KEYLENS_AI_API_KEY = "env-key";
      process.env.ANTHROPIC_API_KEY = "anthropic-key";

      const ai = await createAnalyzer(
        makeAIConfig({ enabled: true, apiKey: "config-key" }),
      );

      expect(ai.isAvailable()).toBe(true);
    });

    it("should fall back to KEYLENS_AI_API_KEY env var", async () => {
      process.env.KEYLENS_AI_API_KEY = "env-key";

      const ai = await createAnalyzer(makeAIConfig({ enabled: true }));

      expect(ai.isAvailable()).toBe(true);
    });

    it("should fall back to ANTHROPIC_API_KEY env var", async () => {
      process.env.ANTHROPIC_API_KEY = "anthropic-key";

      const ai = await createAnalyzer(makeAIConfig({ enabled: true }));

      expect(ai.isAvailable()).toBe(true);
    });

    it("should log warning when enabled but no key found", async () => {
      await createAnalyzer(makeAIConfig({ enabled: true }));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("no API key found"),
      );
    });

    it("should not log warning when enabled with transport but no key", async () => {
      const transport = { query: vi.fn(), queryVision: vi.fn() };
      await createAnalyzer(makeAIConfig({ enabled: true, transport }));

      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("no API key found"),
      );
    });
  });

  describe("transport routing", () => {
    it("should use transport for text queries when no apiKey", async () => {
      const transport = {
        query: vi.fn().mockResolvedValue(
          JSON.stringify({
            summary: "Fix it",
            wcagRef: "2.1.2",
            explanation: "Do this",
            estimatedEffort: "low",
          }),
        ),
        queryVision: vi.fn(),
      };

      const ai = await createAnalyzer(
        makeAIConfig({ enabled: true, transport }),
      );

      const violations: RuleViolation[] = [
        {
          ruleId: "keyboard-trap",
          ruleName: "Keyboard Trap",
          severity: "error",
          message: "Trap detected",
          elements: [],
          impact: "High",
        },
      ];

      await ai.generateFixSuggestions(violations);

      expect(transport.query).toHaveBeenCalled();
      expect(violations[0].fixSuggestion).toBeDefined();
    });

    it("should use transport for vision queries when no apiKey", async () => {
      const transport = {
        query: vi.fn(),
        queryVision: vi.fn().mockResolvedValue(
          JSON.stringify({
            issues: [],
            overallAssessment: "good",
            summary: "Focus order looks correct",
          }),
        ),
      };

      const ai = await createAnalyzer(
        makeAIConfig({ enabled: true, transport }),
      );

      const result = await ai.validateFocusOrder(
        [makeFocusedElement({ tabIndex: 1 })],
        "x".repeat(200),
        { width: 1280, height: 720 },
      );

      expect(transport.queryVision).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should prefer direct API over transport when apiKey is set", async () => {
      const transport = {
        query: vi.fn(),
        queryVision: vi.fn(),
      };

      const ai = await createAnalyzer(
        makeAIConfig({ enabled: true, apiKey: "sk-test", transport }),
      );

      // With an apiKey, transport should not be used; instead it
      // tries the direct Anthropic SDK, which will fail since it's
      // not installed in the test environment.
      const violations: RuleViolation[] = [
        {
          ruleId: "test",
          ruleName: "Test",
          severity: "error",
          message: "Issue",
          elements: [],
          impact: "High",
        },
      ];

      await ai.generateFixSuggestions(violations);

      expect(transport.query).not.toHaveBeenCalled();
    });
  });

  describe("generateFixSuggestions", () => {
    it("should skip when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));
      const violations: RuleViolation[] = [
        {
          ruleId: "test",
          ruleName: "Test",
          severity: "error",
          message: "Issue",
          elements: [],
          impact: "High",
        },
      ];

      await ai.generateFixSuggestions(violations);

      // Should not modify violations
      expect(violations[0].fixSuggestion).toBeUndefined();
    });

    it("should skip when fixSuggestions feature is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: false,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );
      const violations: RuleViolation[] = [
        {
          ruleId: "test",
          ruleName: "Test",
          severity: "error",
          message: "Issue",
          elements: [],
          impact: "High",
        },
      ];

      await ai.generateFixSuggestions(violations);

      expect(violations[0].fixSuggestion).toBeUndefined();
    });
  });

  describe("validateFocusOrder", () => {
    it("should return null when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.validateFocusOrder(
        [makeFocusedElement()],
        "base64screenshot",
      );

      expect(result).toBeNull();
    });

    it("should return null when focusOrderValidation feature is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: false,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.validateFocusOrder(
        [makeFocusedElement()],
        "base64screenshot",
      );

      expect(result).toBeNull();
    });

    it("should accept pageDimensions parameter", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.validateFocusOrder(
        [makeFocusedElement()],
        "base64screenshot",
        { width: 1280, height: 720 },
      );

      expect(result).toBeNull();
    });
  });

  describe("generateSummary", () => {
    it("should return null when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.generateSummary(makeAuditReport());

      expect(result).toBeNull();
    });

    it("should return null when reportSummary feature is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: false,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.generateSummary(makeAuditReport());

      expect(result).toBeNull();
    });
  });

  describe("classifyWidgets", () => {
    it("should return empty array when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.classifyWidgets([
        makeInteractiveElement({ role: "tablist" }),
      ]);

      expect(result).toEqual([]);
    });

    it("should return empty array when widgetClassification feature is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.classifyWidgets([
        makeInteractiveElement({ role: "tablist" }),
      ]);

      expect(result).toEqual([]);
    });

    it("should return empty array when no classifiable elements exist", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: true,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      // Elements with basic roles (button, link, textbox) are filtered out
      const result = await ai.classifyWidgets([
        makeInteractiveElement({ role: "button" }),
        makeInteractiveElement({ role: "link" }),
        makeInteractiveElement({ role: "textbox" }),
      ]);

      expect(result).toEqual([]);
    });
  });

  describe("inferAccessibleNames", () => {
    it("should return empty array when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.inferAccessibleNames(
        [makeInteractiveElement({ accessibleName: "" })],
        "base64screenshot",
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when accessibleNameInference is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.inferAccessibleNames(
        [makeInteractiveElement({ accessibleName: "" })],
        "base64screenshot",
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when all elements have proper names", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: true,
            crossPagePatterns: true,
          },
        }),
      );

      // All elements have meaningful names — no candidates
      const result = await ai.inferAccessibleNames(
        [
          makeInteractiveElement({ accessibleName: "Submit form" }),
          makeInteractiveElement({ accessibleName: "Navigation menu" }),
        ],
        "base64screenshot",
      );

      expect(result).toEqual([]);
    });

    it("should accept pageDimensions parameter", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.inferAccessibleNames(
        [makeInteractiveElement({ accessibleName: "" })],
        "base64screenshot",
        { width: 1280, height: 720 },
      );

      expect(result).toEqual([]);
    });
  });

  describe("scoreFocusIndicatorQuality", () => {
    it("should return empty array when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.scoreFocusIndicatorQuality([
        makeFocusedElement({
          focusedScreenshot: "base64",
          unfocusedScreenshot: "base64",
          hasFocusIndicator: true,
        }),
      ]);

      expect(result).toEqual([]);
    });

    it("should return empty array when focusIndicatorQuality feature is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.scoreFocusIndicatorQuality([
        makeFocusedElement({
          focusedScreenshot: "base64",
          unfocusedScreenshot: "base64",
          hasFocusIndicator: true,
        }),
      ]);

      expect(result).toEqual([]);
    });

    it("should return empty array when no elements have screenshots", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: true,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.scoreFocusIndicatorQuality([
        makeFocusedElement({ hasFocusIndicator: true }),
      ]);

      expect(result).toEqual([]);
    });

    it("should return empty array when no elements have confirmed focus indicators", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: true,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.scoreFocusIndicatorQuality([
        makeFocusedElement({
          focusedScreenshot: "base64",
          unfocusedScreenshot: "base64",
          hasFocusIndicator: false,
        }),
      ]);

      expect(result).toEqual([]);
    });
  });

  describe("generateMultiPageSummary", () => {
    it("should return null when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.generateMultiPageSummary(makeMultiPageReport());

      expect(result).toBeNull();
    });

    it("should return null when reportSummary feature is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: false,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.generateMultiPageSummary(makeMultiPageReport());

      expect(result).toBeNull();
    });
  });

  describe("detectCrossPagePatterns", () => {
    it("should return empty array when not available", async () => {
      const ai = await createAnalyzer(makeAIConfig({ enabled: false }));

      const result = await ai.detectCrossPagePatterns(
        makeMultiPageReport({
          pages: [makeAuditReport(), makeAuditReport()],
        }),
      );

      expect(result).toEqual([]);
    });

    it("should return empty array when crossPagePatterns feature is disabled", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: false,
          },
        }),
      );

      const result = await ai.detectCrossPagePatterns(
        makeMultiPageReport({
          pages: [makeAuditReport(), makeAuditReport()],
        }),
      );

      expect(result).toEqual([]);
    });

    it("should return empty array with single page", async () => {
      const ai = await createAnalyzer(
        makeAIConfig({
          enabled: true,
          apiKey: "sk-test",
          features: {
            focusOrderValidation: true,
            fixSuggestions: true,
            widgetClassification: false,
            reportSummary: true,
            focusIndicatorQuality: false,
            accessibleNameInference: false,
            crossPagePatterns: true,
          },
        }),
      );

      const result = await ai.detectCrossPagePatterns(
        makeMultiPageReport({
          pages: [makeAuditReport()],
        }),
      );

      expect(result).toEqual([]);
    });
  });

  // ─── Happy-path: transport → parse → typed result ──────────────

  describe("generateFixSuggestions (happy path)", () => {
    it("should parse structured fix suggestions via transport", async () => {
      const response = JSON.stringify([
        {
          violationIndex: 1,
          summary: "Add tabindex=\"0\"",
          wcagRef: "2.1.1",
          explanation: "Make the div focusable",
          estimatedEffort: "low",
        },
      ]);
      const transport = { query: vi.fn().mockResolvedValue(response), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({ enabled: true, transport }));

      const violations: RuleViolation[] = [
        { ruleId: "unreachable", ruleName: "Unreachable", severity: "error", message: "Not reachable", elements: [], impact: "High" },
      ];
      await ai.generateFixSuggestions(violations);

      expect(violations[0].fixSuggestion).toEqual({
        summary: "Add tabindex=\"0\"",
        wcagRef: "2.1.1",
        explanation: "Make the div focusable",
        estimatedEffort: "low",
      });
    });

    it("should fall back to raw string when transport returns invalid JSON", async () => {
      const transport = { query: vi.fn().mockResolvedValue("Just add tabindex"), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({ enabled: true, transport }));

      const violations: RuleViolation[] = [
        { ruleId: "test", ruleName: "Test", severity: "error", message: "Issue", elements: [], impact: "High" },
      ];
      await ai.generateFixSuggestions(violations);

      expect(violations[0].fixSuggestion).toBe("Just add tabindex");
    });
  });

  describe("validateFocusOrder (happy path)", () => {
    it("should return structured AIFocusOrderResult via vision transport", async () => {
      const response = JSON.stringify({
        summary: "Focus order is logical",
        issues: [],
        overallAssessment: "good",
      });
      const transport = { query: vi.fn(), queryVision: vi.fn().mockResolvedValue(response) };
      const ai = await createAnalyzer(makeAIConfig({ enabled: true, transport }));

      const result = await ai.validateFocusOrder(
        [makeFocusedElement({ tabIndex: 1 })],
        "x".repeat(200),
        { width: 1280, height: 720 },
      );

      expect(result).toEqual({
        summary: "Focus order is logical",
        issues: [],
        overallAssessment: "good",
      });
    });

    it("should fall back to text-only analysis when vision returns invalid JSON", async () => {
      const transport = {
        query: vi.fn().mockResolvedValue("Focus order looks fine"),
        queryVision: vi.fn().mockResolvedValue("not json"),
      };
      const ai = await createAnalyzer(makeAIConfig({ enabled: true, transport }));

      const result = await ai.validateFocusOrder(
        [makeFocusedElement({ tabIndex: 1 })],
        "x".repeat(200),
        { width: 1280, height: 720 },
      );

      expect(result).toBe("Focus order looks fine");
    });
  });

  describe("generateSummary (happy path)", () => {
    it("should return structured AIReportSummary via transport", async () => {
      const response = JSON.stringify({
        overview: "Good keyboard accessibility overall.",
        criticalIssues: ["Missing skip link"],
        prioritizedFixes: [{ fix: "Add skip link", effort: "low", impact: "high" }],
        aiSeverityRating: 78,
        recommendation: "Add a skip link.",
      });
      const transport = { query: vi.fn().mockResolvedValue(response), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({ enabled: true, transport }));

      const result = await ai.generateSummary(makeAuditReport());

      expect(result).toEqual(expect.objectContaining({ aiSeverityRating: 78, overview: "Good keyboard accessibility overall." }));
    });

    it("should return plain string when transport returns non-JSON", async () => {
      const transport = { query: vi.fn().mockResolvedValue("Overall the page is accessible."), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({ enabled: true, transport }));

      const result = await ai.generateSummary(makeAuditReport());

      expect(result).toBe("Overall the page is accessible.");
    });
  });

  describe("classifyWidgets (happy path)", () => {
    it("should return typed WidgetClassification[] via transport", async () => {
      const response = JSON.stringify([
        {
          index: 1,
          pattern: "tabs",
          confidence: 0.95,
          expectedKeyboard: [{ key: "ArrowRight", expectedBehavior: "Move to next tab" }],
        },
      ]);
      const transport = { query: vi.fn().mockResolvedValue(response), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({
        enabled: true,
        transport,
        features: {
          focusOrderValidation: true, fixSuggestions: true, widgetClassification: true,
          reportSummary: true, focusIndicatorQuality: false, accessibleNameInference: false, crossPagePatterns: true,
        },
      }));

      const result = await ai.classifyWidgets([
        makeInteractiveElement({ role: "tablist", accessibleName: "Settings" }),
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].pattern).toBe("tabs");
      expect(result[0].confidence).toBe(0.95);
    });

    it("should filter out low-confidence classifications", async () => {
      const response = JSON.stringify([
        { index: 1, pattern: "menu", confidence: 0.3, expectedKeyboard: [] },
      ]);
      const transport = { query: vi.fn().mockResolvedValue(response), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({
        enabled: true,
        transport,
        features: {
          focusOrderValidation: true, fixSuggestions: true, widgetClassification: true,
          reportSummary: true, focusIndicatorQuality: false, accessibleNameInference: false, crossPagePatterns: true,
        },
      }));

      const result = await ai.classifyWidgets([
        makeInteractiveElement({ role: "tablist" }),
      ]);

      expect(result).toEqual([]);
    });
  });

  describe("inferAccessibleNames (happy path)", () => {
    it("should return typed AccessibleNameSuggestion[] via transport", async () => {
      const response = JSON.stringify([
        { index: 1, suggestedLabel: "Close dialog", confidence: 0.9, reasoning: "X icon button closes modal" },
      ]);
      const transport = { query: vi.fn().mockResolvedValue(response), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({
        enabled: true,
        transport,
        features: {
          focusOrderValidation: true, fixSuggestions: true, widgetClassification: false,
          reportSummary: true, focusIndicatorQuality: false, accessibleNameInference: true, crossPagePatterns: true,
        },
      }));

      const result = await ai.inferAccessibleNames(
        [makeInteractiveElement({ accessibleName: "" })],
        "short", // no screenshot
      );

      expect(result).toHaveLength(1);
      expect(result[0].suggestedLabel).toBe("Close dialog");
    });
  });

  describe("scoreFocusIndicatorQuality (happy path)", () => {
    it("should return typed FocusIndicatorScore[] via vision transport", async () => {
      const response = JSON.stringify([
        { elementIndex: 1, score: 9, contrast: "sufficient", visibility: "clear" },
      ]);
      const transport = { query: vi.fn(), queryVision: vi.fn().mockResolvedValue(response) };
      const ai = await createAnalyzer(makeAIConfig({
        enabled: true,
        transport,
        features: {
          focusOrderValidation: true, fixSuggestions: true, widgetClassification: false,
          reportSummary: true, focusIndicatorQuality: true, accessibleNameInference: false, crossPagePatterns: true,
        },
      }));

      const result = await ai.scoreFocusIndicatorQuality([
        makeFocusedElement({
          focusedScreenshot: "base64-focused",
          unfocusedScreenshot: "base64-unfocused",
          hasFocusIndicator: true,
        }),
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(9);
      expect(result[0].contrast).toBe("sufficient");
    });
  });

  describe("detectCrossPagePatterns (happy path)", () => {
    it("should return typed CrossPagePattern[] via transport", async () => {
      const response = JSON.stringify([
        {
          findingIndex: 1,
          type: "inconsistent-order",
          description: "Nav tabs in different order",
          severity: "warning",
          suggestion: "Standardize navigation tab order",
        },
      ]);
      const transport = { query: vi.fn().mockResolvedValue(response), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({
        enabled: true,
        transport,
        features: {
          focusOrderValidation: true, fixSuggestions: true, widgetClassification: false,
          reportSummary: true, focusIndicatorQuality: false, accessibleNameInference: false, crossPagePatterns: true,
        },
      }));

      // Need 2 pages with shared elements at different tab positions to trigger heuristic
      const report = makeMultiPageReport({
        pages: [
          makeAuditReport({
            url: "https://example.com/page1",
            focusSequence: [
              makeFocusedElement({ selector: "nav a.home", tabIndex: 1 }),
              makeFocusedElement({ selector: "nav a.about", tabIndex: 2 }),
            ],
          }),
          makeAuditReport({
            url: "https://example.com/page2",
            focusSequence: [
              makeFocusedElement({ selector: "nav a.about", tabIndex: 1 }),
              makeFocusedElement({ selector: "nav a.home", tabIndex: 2 }),
            ],
          }),
        ],
      });

      const result = await ai.detectCrossPagePatterns(report);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("inconsistent-order");
    });

    it("should fall back to heuristic-only patterns when AI returns invalid JSON", async () => {
      const transport = { query: vi.fn().mockResolvedValue("not valid json"), queryVision: vi.fn() };
      const ai = await createAnalyzer(makeAIConfig({
        enabled: true,
        transport,
        features: {
          focusOrderValidation: true, fixSuggestions: true, widgetClassification: false,
          reportSummary: true, focusIndicatorQuality: false, accessibleNameInference: false, crossPagePatterns: true,
        },
      }));

      const report = makeMultiPageReport({
        pages: [
          makeAuditReport({
            url: "https://example.com/page1",
            focusSequence: [
              makeFocusedElement({ selector: "nav a.home", tabIndex: 1 }),
              makeFocusedElement({ selector: "nav a.about", tabIndex: 2 }),
            ],
          }),
          makeAuditReport({
            url: "https://example.com/page2",
            focusSequence: [
              makeFocusedElement({ selector: "nav a.about", tabIndex: 1 }),
              makeFocusedElement({ selector: "nav a.home", tabIndex: 2 }),
            ],
          }),
        ],
      });

      const result = await ai.detectCrossPagePatterns(report);

      // Should still produce heuristic-based patterns despite AI failure
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("inconsistent-order");
    });
  });
});
