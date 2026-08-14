import type {
  AIConfig,
  AuditReport,
  MultiPageReport,
  RuleViolation,
  FocusedElement,
  InteractiveElement,
  WidgetClassification,
  AccessibleNameSuggestion,
  FocusIndicatorScore,
  AIFocusOrderResult,
  AIReportSummary,
  CrossPagePattern,
  AuditAsset,
} from "../types/index.js";
import { logger } from "../utils/logger.js";
import { resolveAIAPIKey } from "../utils/config.js";
import { AIProvider, type AIFeatureContext } from "./provider.js";
import { generateFixSuggestions as runFixSuggestions } from "./features/fix-suggestions.js";
import { validateFocusOrder as runFocusOrderValidation } from "./features/focus-order-validation.js";
import {
  generateSummary as runSummary,
  generateMultiPageSummary as runMultiPageSummary,
} from "./features/report-summary.js";
import { classifyWidgets as runWidgetClassification } from "./features/widget-classification.js";
import { inferAccessibleNames as runAccessibleNameInference } from "./features/accessible-names.js";
import { scoreFocusIndicatorQuality as runFocusIndicatorQuality } from "./features/focus-indicator-quality.js";
import { detectCrossPagePatterns as runCrossPagePatternDetection } from "./features/cross-page-patterns.js";

/**
 * AI-powered analysis layer for Keylens.
 * Provides intelligent focus order validation, fix suggestions,
 * widget classification, accessible name inference, and report summaries.
 *
 * Requires an API key for the configured provider.
 * The tool works fully without AI — these are enhancement features.
 *
 * This class is a thin facade: each public method is gated by
 * `isAvailable()` and its own `config.features.*` flag, then delegates to a
 * standalone function under `./features/` that implements the feature. All
 * AI SDK/transport plumbing (provider routing, client caching) lives in
 * `./provider.js`. See `docs/guide/ai.md` for the full feature list.
 */
export class AIAnalyzer {
  private config: AIConfig;
  private apiKey: string | null;
  private ctx: AIFeatureContext;

  constructor(config: AIConfig, signal?: AbortSignal) {
    this.config = config;
    this.apiKey = resolveAIAPIKey(config) ?? null;

    if (config.enabled && !this.apiKey && !config.transport) {
      const providerKeyHint =
        config.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
      logger.warn(
        `AI is enabled but no API key found. Set KEYLENS_AI_API_KEY or ${providerKeyHint} env var, or use ai.apiKey in config. AI features will be skipped.`,
      );
    }

    const provider = new AIProvider(config, this.apiKey, signal);
    this.ctx = { config, provider, signal };
  }

  /**
   * Check if AI analysis is available (enabled + has API key or transport).
   */
  isAvailable(): boolean {
    return (
      this.config.enabled && (this.apiKey !== null || !!this.config.transport)
    );
  }

  /**
   * Generate AI-powered fix suggestions for violations.
   * Batches all violations into a single AI call for performance.
   * Returns structured FixSuggestion when possible, falls back to string.
   */
  async generateFixSuggestions(violations: RuleViolation[]): Promise<void> {
    if (!this.isAvailable() || !this.config.features.fixSuggestions) return;
    return runFixSuggestions(this.ctx, violations);
  }

  /**
   * Validate focus order using AI analysis.
   * When a page screenshot is available, uses vision-based analysis with
   * annotated markers for each focus position. Falls back to text-only.
   */
  async validateFocusOrder(
    focusSequence: FocusedElement[],
    pageScreenshot: string,
    pageDimensions?: { width: number; height: number },
  ): Promise<string | AIFocusOrderResult | null> {
    if (!this.isAvailable() || !this.config.features.focusOrderValidation) {
      return null;
    }
    return runFocusOrderValidation(
      this.ctx,
      focusSequence,
      pageScreenshot,
      pageDimensions,
    );
  }

  /**
   * Generate an executive summary of the audit report.
   * Returns structured AIReportSummary when possible, falls back to string.
   */
  async generateSummary(
    report: AuditReport,
  ): Promise<string | AIReportSummary | null> {
    if (!this.isAvailable() || !this.config.features.reportSummary) {
      return null;
    }
    return runSummary(this.ctx, report);
  }

  /**
   * Generate a cross-page executive summary for multi-page audits.
   * Aggregates per-page results and identifies cross-page themes.
   */
  async generateMultiPageSummary(
    report: MultiPageReport,
  ): Promise<string | AIReportSummary | null> {
    if (!this.isAvailable() || !this.config.features.reportSummary) {
      return null;
    }
    return runMultiPageSummary(this.ctx, report);
  }

  /**
   * Classify interactive elements by WAI-ARIA APG pattern.
   * Identifies dialogs, menus, tabs, disclosures, etc. and returns
   * expected keyboard interactions for each.
   */
  async classifyWidgets(
    elements: InteractiveElement[],
  ): Promise<WidgetClassification[]> {
    if (!this.isAvailable() || !this.config.features.widgetClassification) {
      return [];
    }
    return runWidgetClassification(this.ctx, elements);
  }

  /**
   * Infer accessible names for elements with empty or generic names.
   * Uses vision analysis when a page screenshot is available.
   */
  async inferAccessibleNames(
    interactiveElements: InteractiveElement[],
    pageScreenshot: string,
    pageDimensions?: { width: number; height: number },
  ): Promise<AccessibleNameSuggestion[]> {
    if (!this.isAvailable() || !this.config.features.accessibleNameInference) {
      return [];
    }
    return runAccessibleNameInference(
      this.ctx,
      interactiveElements,
      pageScreenshot,
      pageDimensions,
    );
  }

  /**
   * Score the quality of focus indicators using vision analysis.
   * Batches multiple elements into a single vision call for performance.
   * Only scores elements with confirmed focus indicators and both screenshots.
   * Limited to 10 elements per audit.
   */
  async scoreFocusIndicatorQuality(
    focusSequence: FocusedElement[],
    assets: AuditAsset[],
  ): Promise<FocusIndicatorScore[]> {
    if (!this.isAvailable() || !this.config.features.focusIndicatorQuality) {
      return [];
    }
    return runFocusIndicatorQuality(this.ctx, focusSequence, assets);
  }

  /**
   * Detect inconsistent keyboard navigation patterns across multiple pages.
   * Uses heuristic pre-filtering to minimize AI calls.
   * Only invokes AI when heuristics find potential issues.
   */
  async detectCrossPagePatterns(
    report: MultiPageReport,
  ): Promise<CrossPagePattern[]> {
    if (!this.isAvailable() || !this.config.features.crossPagePatterns) {
      return [];
    }
    return runCrossPagePatternDetection(this.ctx, report);
  }
}
