import { join } from "path";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  audit,
  auditMultiple,
  crawlOnly,
  AIAnalyzer,
  DEFAULT_CONFIG,
} from "../index.js";
import type {
  KeylensConfig,
  AuditReport,
  MultiPageReport,
  FocusedElement,
  ReporterType,
  RuleResult,
  RuleViolation,
  WidgetClassification,
  AccessibleNameSuggestion,
} from "../types/index.js";
import { runReporters, runMultiReporters } from "../reporters/index.js";
import { setLogLevel } from "../utils/logger.js";
import { SamplingTransport } from "./sampling.js";

// ─── Types ──────────────────────────────────────────────────────

export interface AuditOptions {
  browser?: "chromium" | "firefox" | "webkit";
  viewport?: { width?: number; height?: number };
  maxTabs?: number;
  tabDelay?: number;
  waitForSelector?: string;
  waitAfterLoad?: number;
  screenshots?: boolean;
  interactions?: boolean;
  ai?: boolean;
  reporters?: ReporterType[];
  outputDir?: string;
}

export interface McpToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ─── Config Builder ─────────────────────────────────────────────

export function buildConfig(options?: AuditOptions): KeylensConfig {
  const config: KeylensConfig = {
    ...DEFAULT_CONFIG,
    ai: { ...DEFAULT_CONFIG.ai, features: { ...DEFAULT_CONFIG.ai.features } },
    reporters: [],
    outputDir: join(process.cwd(), "keylens-report"),
    headed: false,
  };

  // Environment variable overrides
  const envBrowser = process.env.KEYLENS_BROWSER;
  if (envBrowser && ["chromium", "firefox", "webkit"].includes(envBrowser)) {
    config.browser = envBrowser as KeylensConfig["browser"];
  }

  const envMaxTabs = process.env.KEYLENS_MAX_TABS;
  if (envMaxTabs) {
    const parsed = parseInt(envMaxTabs, 10);
    if (!isNaN(parsed) && parsed > 0) {
      config.maxTabs = parsed;
    }
  }

  const aiKey =
    process.env.KEYLENS_AI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY;
  if (aiKey) {
    config.ai = { ...config.ai, apiKey: aiKey };
  }

  const aiBaseURL = process.env.KEYLENS_AI_BASE_URL;
  if (aiBaseURL) {
    config.ai = { ...config.ai, baseURL: aiBaseURL };
  }

  // Caller-provided options
  if (options) {
    if (options.browser) config.browser = options.browser;
    if (options.viewport) {
      config.viewport = {
        width: options.viewport.width ?? config.viewport.width,
        height: options.viewport.height ?? config.viewport.height,
      };
    }
    if (options.maxTabs) config.maxTabs = options.maxTabs;
    if (options.tabDelay) config.tabDelay = Math.max(10, options.tabDelay);
    if (options.waitForSelector)
      config.waitForSelector = options.waitForSelector;
    if (options.waitAfterLoad !== undefined)
      config.waitAfterLoad = options.waitAfterLoad;
    if (options.screenshots) config.captureElementScreenshots = true;
    if (options.interactions) config.interactions = true;
    if (options.ai) config.ai = { ...config.ai, enabled: true };
    if (options.reporters) config.reporters = options.reporters;
    if (options.outputDir) config.outputDir = options.outputDir;
  }

  return config;
}

// ─── Sampling Injection ─────────────────────────────────────────

/**
 * If no direct API key is configured and the MCP client supports
 * sampling, inject a SamplingTransport so AI features work without
 * requiring the user to provide a separate API key.
 */
export function injectSampling(config: KeylensConfig, server?: Server): void {
  if (config.ai.apiKey || !server) return;

  const caps = server.getClientCapabilities();
  if (caps?.sampling) {
    config.ai.transport = new SamplingTransport(server);
    config.ai.enabled = true;
  }
}

// ─── Compact Report Helpers (MCP output optimization) ───────────

/**
 * Slim down a FocusedElement to only the fields an LLM needs.
 * Drops: screenshots, outerHTML, boundingRect, pageRect, computedFocusStyles.
 */
function compactElement(el: FocusedElement) {
  return {
    tabIndex: el.tabIndex,
    selector: el.selector,
    tagName: el.tagName,
    role: el.role,
    accessibleName: el.accessibleName,
    tabindexAttr: el.tabindexAttr,
    hasFocusIndicator: el.hasFocusIndicator,
    isObscured: el.isObscured,
  };
}

/**
 * Strip outerHTML from violation elements — selectors are sufficient.
 */
function compactViolation(v: RuleViolation): RuleViolation {
  return {
    ...v,
    elements: v.elements.map(({ selector, tabPosition }) => ({
      selector,
      outerHTML: "",
      tabPosition,
    })),
  };
}

/**
 * Only keep rules that have violations (drop passing rules).
 */
function compactRules(rules: RuleResult[]): RuleResult[] {
  return rules.map((r) => ({
    ...r,
    violations: r.violations.map(compactViolation),
  }));
}

/**
 * Strip outerHTML from widget classifications.
 */
function compactClassifications(
  classifications?: WidgetClassification[],
): WidgetClassification[] | undefined {
  return classifications?.map((c) => ({
    ...c,
    element: {
      selector: c.element.selector,
      tagName: c.element.tagName,
      role: c.element.role,
      accessibleName: c.element.accessibleName,
      outerHTML: "",
    },
  }));
}

/**
 * Strip outerHTML from accessible name suggestions.
 */
function compactNameSuggestions(
  suggestions?: AccessibleNameSuggestion[],
): AccessibleNameSuggestion[] | undefined {
  return suggestions?.map((s) => ({
    ...s,
    element: {
      selector: s.element.selector,
      tagName: s.element.tagName,
      role: s.element.role,
      outerHTML: "",
    },
  }));
}

/**
 * Produce a compact single-page report for MCP consumption.
 * Strips: screenshots, outerHTML, boundingRect, pageRect,
 * computedFocusStyles, and the echoed config object.
 */
export function compactReport(report: AuditReport) {
  return {
    version: report.version,
    timestamp: report.timestamp,
    url: report.url,
    crawl: report.crawl,
    rules: compactRules(report.rules),
    summary: report.summary,
    focusSequence: report.focusSequence?.map(compactElement),
    pageDimensions: report.pageDimensions,
    // AI fields (pass through as-is — they're already text/structured)
    aiSummary: report.aiSummary,
    aiFocusOrderAnalysis: report.aiFocusOrderAnalysis,
    widgetClassifications: compactClassifications(report.widgetClassifications),
    accessibleNameSuggestions: compactNameSuggestions(
      report.accessibleNameSuggestions,
    ),
    focusIndicatorScores: report.focusIndicatorScores,
  };
}

/**
 * Produce a compact multi-page report for MCP consumption.
 * Per-page: only url, summary, violations (no full focusSequence),
 * skip link result, and AI summary.
 * Top-level: aggregate summary, AI fields, cross-page patterns.
 */
export function compactMultiPageReport(report: MultiPageReport) {
  return {
    version: report.version,
    timestamp: report.timestamp,
    urls: report.urls,
    summary: report.summary,
    pages: report.pages.map((page) => ({
      url: page.url,
      summary: page.summary,
      crawl: page.crawl,
      rules: compactRules(page.rules).filter(
        (r) => !r.passed || r.violations.length > 0,
      ),
      aiSummary: page.aiSummary,
    })),
    aiSummary: report.aiSummary,
    crossPagePatterns: report.crossPagePatterns,
  };
}

// ─── Tool Handlers ──────────────────────────────────────────────

export async function handleAudit(
  params: { url: string; options?: AuditOptions },
  server?: Server,
): Promise<McpToolResponse> {
  setLogLevel("silent");

  try {
    const config = buildConfig(params.options);
    injectSampling(config, server);
    const report = await audit(params.url, config);
    if (config.reporters.length > 0) {
      await runReporters(report, config.reporters, config.outputDir);
    }
    const clean = compactReport(report);
    return {
      content: [{ type: "text", text: JSON.stringify(clean) }],
    };
  } catch (error) {
    return {
      content: [
        { type: "text", text: `Audit failed: ${(error as Error).message}` },
      ],
      isError: true,
    };
  }
}

export async function handleAuditMultiple(
  params: { urls: string[]; options?: AuditOptions },
  server?: Server,
): Promise<McpToolResponse> {
  setLogLevel("silent");

  try {
    const config = buildConfig(params.options);
    injectSampling(config, server);
    const report = await auditMultiple(params.urls, config);
    if (config.reporters.length > 0) {
      await runMultiReporters(report, config.reporters, config.outputDir);
    }
    const clean = compactMultiPageReport(report);
    return {
      content: [{ type: "text", text: JSON.stringify(clean) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Multi-page audit failed: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleClassifyWidgets(
  params: { url: string },
  server?: Server,
): Promise<McpToolResponse> {
  setLogLevel("silent");

  try {
    const config = buildConfig({ ai: true });
    injectSampling(config, server);
    config.ai.features = {
      ...config.ai.features,
      widgetClassification: true,
      focusOrderValidation: false,
      fixSuggestions: false,
      reportSummary: false,
      focusIndicatorQuality: false,
      accessibleNameInference: false,
      crossPagePatterns: false,
    };

    // Use lightweight crawl-only path — skip rules, reporters, and other AI features
    const crawlResult = await crawlOnly(params.url, config);
    const ai = new AIAnalyzer(config.ai);

    if (!ai.isAvailable()) {
      return {
        content: [
          {
            type: "text",
            text: "AI is not available. Widget classification requires AI (API key or MCP sampling).",
          },
        ],
        isError: true,
      };
    }

    const classifications = await ai.classifyWidgets(
      crawlResult.interactiveElements,
    );

    if (classifications.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No complex ARIA widgets detected on this page.",
          },
        ],
      };
    }

    const compact = classifications.map((c) => ({
      ...c,
      element: {
        selector: c.element.selector,
        tagName: c.element.tagName,
        role: c.element.role,
        accessibleName: c.element.accessibleName,
        outerHTML: "",
      },
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(compact) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Widget classification failed: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleValidateFocusOrder(
  params: { url: string },
  server?: Server,
): Promise<McpToolResponse> {
  setLogLevel("silent");

  try {
    const config = buildConfig({ ai: true, screenshots: true });
    injectSampling(config, server);
    config.ai.features = {
      ...config.ai.features,
      focusOrderValidation: true,
      fixSuggestions: false,
      widgetClassification: false,
      reportSummary: false,
      focusIndicatorQuality: false,
      accessibleNameInference: false,
      crossPagePatterns: false,
    };

    // Use lightweight crawl-only path — skip rules, reporters, and other AI features
    const crawlResult = await crawlOnly(params.url, config);
    const ai = new AIAnalyzer(config.ai);

    if (!ai.isAvailable()) {
      // Return basic focus sequence when AI is unavailable
      const sequence = crawlResult.focusSequence.map((el, i) => ({
        position: i + 1,
        selector: el.selector,
        tagName: el.tagName,
        role: el.role,
        accessibleName: el.accessibleName,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              note: "AI analysis unavailable. Returning raw focus sequence.",
              focusSequence: sequence,
              totalElements: sequence.length,
              cycleCompleted: crawlResult.cycleCompleted,
            }),
          },
        ],
      };
    }

    const analysis = await ai.validateFocusOrder(
      crawlResult.focusSequence,
      crawlResult.pageScreenshot,
      crawlResult.pageDimensions,
    );

    if (!analysis) {
      const sequence = crawlResult.focusSequence.map((el, i) => ({
        position: i + 1,
        selector: el.selector,
        tagName: el.tagName,
        role: el.role,
        accessibleName: el.accessibleName,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              note: "AI analysis returned no results. Returning raw focus sequence.",
              focusSequence: sequence,
              totalElements: sequence.length,
              cycleCompleted: crawlResult.cycleCompleted,
            }),
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(analysis) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Focus order validation failed: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
