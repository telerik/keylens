import type {
  AuditReport,
  KeylensConfig,
  MultiPageReport,
  CrawlResult,
  WidgetClassification,
  AccessibleNameSuggestion,
  FocusIndicatorScore,
} from "./types/index.js";
import { crawlPage } from "./crawler/index.js";
import { runRules } from "./rules/index.js";
import { runReporters } from "./reporters/index.js";
import { AIAnalyzer } from "./ai/index.js";
import { logger } from "./utils/logger.js";
import { computeScore } from "./utils/score.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

/**
 * Run a complete Keylens keyboard navigation audit.
 *
 * This is the main programmatic API entry point.
 *
 * @example
 * ```ts
 * import { audit } from "keylens";
 *
 * const report = await audit("https://example.com", {
 *   reporters: ["cli", "json"],
 *   ai: { enabled: true },
 * });
 *
 * if (report.summary.totalErrors > 0) {
 *   process.exit(1);
 * }
 * ```
 */
export async function audit(
  url: string,
  config: KeylensConfig,
): Promise<AuditReport> {
  const startTime = Date.now();

  logger.blank();
  logger.info(`Starting Keylens audit for ${url}`);
  logger.divider();

  // Phase 1: Crawl the page
  const crawlResult = await crawlPage(url, config);

  // Phase 2: Run rules
  const ruleResults = await runRules(crawlResult, config);

  // Phase 3: AI analysis (if enabled)
  const ai = new AIAnalyzer(config.ai);

  let aiFocusOrderAnalysis: AuditReport["aiFocusOrderAnalysis"];
  let widgetClassifications: WidgetClassification[] | undefined;
  let accessibleNameSuggestions: AccessibleNameSuggestion[] | undefined;
  let focusIndicatorScores: FocusIndicatorScore[] | undefined;

  if (ai.isAvailable()) {
    // Run independent AI analyses in parallel for performance
    const allViolations = ruleResults.flatMap((r) => r.violations);

    const [, focusOrderAnalysis, classifications, nameSuggestions, fiScores] =
      await Promise.all([
        ai.generateFixSuggestions(allViolations),
        ai.validateFocusOrder(
          crawlResult.focusSequence,
          crawlResult.pageScreenshot,
          crawlResult.pageDimensions,
        ),
        ai.classifyWidgets(crawlResult.interactiveElements),
        ai.inferAccessibleNames(
          crawlResult.interactiveElements,
          crawlResult.pageScreenshot,
          crawlResult.pageDimensions,
        ),
        ai.scoreFocusIndicatorQuality(crawlResult.focusSequence),
      ]);

    if (focusOrderAnalysis) {
      aiFocusOrderAnalysis = focusOrderAnalysis;
      logger.info("AI focus order analysis completed");
    }

    if (classifications.length > 0) {
      widgetClassifications = classifications;
      logger.info(`AI classified ${classifications.length} widget(s)`);
    }

    if (nameSuggestions.length > 0) {
      accessibleNameSuggestions = nameSuggestions;
      logger.info(
        `AI suggested names for ${nameSuggestions.length} element(s)`,
      );
    }

    if (fiScores.length > 0) {
      focusIndicatorScores = fiScores;
      logger.info(
        `AI scored focus indicators for ${fiScores.length} element(s)`,
      );
    }
  }

  // Build the report
  const report: AuditReport = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    url,
    config: {
      viewport: config.viewport,
      browser: config.browser,
      rules: config.rules,
    },
    crawl: {
      totalFocusableElements: crawlResult.focusSequence.length,
      totalInteractiveElements: crawlResult.interactiveElements.length,
      unreachedElements: crawlResult.interactiveElements.filter(
        (el) => !el.reached,
      ).length,
      cycleCompleted: crawlResult.cycleCompleted,
      duration: crawlResult.crawlDuration,
    },
    rules: ruleResults,
    summary: {
      totalErrors: ruleResults
        .flatMap((r) => r.violations)
        .filter((v) => v.severity === "error").length,
      totalWarnings: ruleResults
        .flatMap((r) => r.violations)
        .filter((v) => v.severity === "warning").length,
      totalInfo: ruleResults
        .flatMap((r) => r.violations)
        .filter((v) => v.severity === "info").length,
      passed: ruleResults.filter((r) => r.passed).length,
      failed: ruleResults.filter((r) => !r.passed).length,
      score: 0, // placeholder — computed below after report object is built
    },
    aiFocusOrderAnalysis,
    widgetClassifications,
    accessibleNameSuggestions,
    focusIndicatorScores,
    pageScreenshot: crawlResult.pageScreenshot,
    focusSequence: crawlResult.focusSequence,
    pageDimensions: crawlResult.pageDimensions,
  };

  // Compute deterministic score (after report is built so it has full data)
  report.summary.score = computeScore(report);

  // Generate AI summary (after report is built so it has full data)
  if (ai.isAvailable()) {
    const summary = await ai.generateSummary(report);
    report.aiSummary = summary ?? undefined;
  }

  // Phase 4: Output reports
  logger.blank();
  await runReporters(report, config.reporters, config.outputDir);

  const totalDuration = Date.now() - startTime;
  logger.blank();
  logger.info(`Total audit time: ${totalDuration}ms`);

  return report;
}

/**
 * Run Keylens audits on multiple URLs and produce an aggregate report.
 */
export async function auditMultiple(
  urls: string[],
  config: KeylensConfig,
): Promise<MultiPageReport> {
  const startTime = Date.now();

  logger.blank();
  logger.info(`Starting Keylens multi-page audit for ${urls.length} URL(s)`);
  logger.divider();

  const pages: AuditReport[] = [];

  for (const url of urls) {
    const pageReport = await audit(url, config);
    pages.push(pageReport);
  }

  const multiReport: MultiPageReport = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    urls,
    pages,
    summary: {
      totalPages: pages.length,
      totalErrors: pages.reduce((sum, p) => sum + p.summary.totalErrors, 0),
      totalWarnings: pages.reduce((sum, p) => sum + p.summary.totalWarnings, 0),
      totalInfo: pages.reduce((sum, p) => sum + p.summary.totalInfo, 0),
      pagesWithErrors: pages.filter((p) => p.summary.totalErrors > 0).length,
      score:
        pages.length > 0
          ? Math.round(
              pages.reduce((sum, p) => sum + p.summary.score, 0) / pages.length,
            )
          : 0,
    },
  };

  // AI analysis for multi-page reports
  const ai = new AIAnalyzer(config.ai);
  if (ai.isAvailable()) {
    // Detect cross-page patterns (heuristic + AI)
    const crossPagePatterns = await ai.detectCrossPagePatterns(multiReport);
    if (crossPagePatterns.length > 0) {
      multiReport.crossPagePatterns = crossPagePatterns;
      logger.info(`Detected ${crossPagePatterns.length} cross-page pattern(s)`);
    }

    // Generate multi-page summary (after patterns so summary can reference them)
    const multiSummary = await ai.generateMultiPageSummary(multiReport);
    if (multiSummary) {
      multiReport.aiSummary = multiSummary;
    }
  }

  const totalDuration = Date.now() - startTime;
  logger.blank();
  logger.info(`Multi-page audit completed in ${totalDuration}ms`);

  return multiReport;
}

/**
 * Lightweight crawl-only path: crawl + rules, no reporters, no AI.
 * Used by MCP specialized tools (classify_widgets, validate_focus_order)
 * to avoid running the full audit pipeline when only one AI feature is needed.
 */
export async function crawlOnly(
  url: string,
  config: KeylensConfig,
): Promise<CrawlResult> {
  logger.info(`Crawling ${url}...`);
  return crawlPage(url, config);
}

// Re-export types and utilities for programmatic use
export type {
  AuditReport,
  MultiPageReport,
  KeylensConfig,
  RuleConfig,
  AIConfig,
  AITransport,
  ReporterType,
  Severity,
  Rule,
  BoundingRect,
  RuleResult,
  RuleViolation,
  CrawlResult,
  FocusedElement,
  InteractiveElement,
  InteractionResult,
  SkipLinkResult,
  WidgetClassification,
  APGPattern,
  AIFocusOrderResult,
  FocusOrderIssue,
  FixSuggestion,
  AccessibleNameSuggestion,
  FocusIndicatorScore,
  AIReportSummary,
  CrossPagePattern,
  CrossPagePatternType,
} from "./types/index.js";

export { DEFAULT_CONFIG } from "./utils/config.js";
export { AIAnalyzer } from "./ai/index.js";
export {
  KeylensError,
  CrawlError,
  ConfigError,
  NavigationError,
} from "./errors.js";
