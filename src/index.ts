import type {
  AIEnrichmentOptions,
  AuditReport,
  AuditOptions,
  KeylensConfig,
  LogLevel,
  MultiPageReport,
  CrawlResult,
  EffectiveKeylensConfig,
  ReporterType,
  RuleResult,
} from "./types/index.js";
import { crawlPage } from "./crawler/index.js";
import { runRules } from "./rules/index.js";
import { runMultiReporters, runReporters } from "./reporters/index.js";
import { AIAnalyzer } from "./ai/index.js";
import { logger, withLogLevel } from "./utils/logger.js";
import { computeScore } from "./utils/score.js";
import { AUDIT_REPORT_SCHEMA_VERSION } from "./types/index.js";
import { hasConfiguredAIAPIKey, normalizeConfig } from "./utils/config.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

interface ResolvedAuditOptions {
  config: KeylensConfig;
  logLevel: LogLevel;
}

function resolveAuditOptions(
  options: AuditOptions | KeylensConfig = {},
): ResolvedAuditOptions {
  const {
    signal: _signal,
    onEvent: _onEvent,
    logLevel = "silent",
    ...configInput
  } = options as AuditOptions;
  void _signal;
  void _onEvent;
  return {
    config: normalizeConfig(configInput),
    logLevel,
  };
}

function resolveEnrichmentOptions(
  baseConfig: EffectiveKeylensConfig,
  options: AIEnrichmentOptions = {},
): ResolvedAuditOptions {
  const {
    signal: _signal,
    onEvent: _onEvent,
    logLevel = "silent",
    ai: aiOverrides,
  } = options;
  void _signal;
  void _onEvent;
  const {
    apiKeyConfigured: _apiKeyConfigured,
    transportConfigured: _transportConfigured,
    ...baseAI
  } = baseConfig.ai;
  void _apiKeyConfigured;
  void _transportConfigured;

  return {
    config: normalizeConfig({
      ...baseConfig,
      ai: {
        ...baseAI,
        ...aiOverrides,
        features: {
          ...baseAI.features,
          ...aiOverrides?.features,
        },
        limits: {
          ...baseAI.limits,
          ...aiOverrides?.limits,
        },
      },
    }),
    logLevel,
  };
}

function sanitizeConfig(config: KeylensConfig): EffectiveKeylensConfig {
  const { apiKey, transport, ...ai } = config.ai;
  void apiKey;
  return structuredClone({
    ...config,
    ai: {
      ...ai,
      apiKeyConfigured: hasConfiguredAIAPIKey(config.ai),
      transportConfigured: Boolean(transport),
    },
  });
}

function buildBaseReport(
  url: string,
  config: KeylensConfig,
  crawlResult: CrawlResult,
  ruleResults: RuleResult[],
  rulesDuration: number,
  totalDuration: number,
): AuditReport {
  const report: AuditReport = {
    schemaVersion: AUDIT_REPORT_SCHEMA_VERSION,
    version: VERSION,
    timestamp: new Date().toISOString(),
    url,
    config: sanitizeConfig(config),
    timings: {
      crawl: crawlResult.crawlDuration,
      rules: rulesDuration,
      total: totalDuration,
    },
    crawl: {
      totalFocusableElements: crawlResult.focusSequence.length,
      totalInteractiveElements: crawlResult.interactiveElements.length,
      unreachedElements: crawlResult.interactiveElements.filter(
        (element) => !element.reached,
      ).length,
      cycleCompleted: crawlResult.cycleCompleted,
      duration: crawlResult.crawlDuration,
      interactionsAttempted: crawlResult.interactionResults?.length,
      interactionsFailed: crawlResult.interactionResults?.filter(
        (result) => !result.focusReasonable,
      ).length,
    },
    rules: ruleResults,
    summary: {
      totalErrors: ruleResults
        .flatMap((result) => result.violations)
        .filter((violation) => violation.severity === "error").length,
      totalWarnings: ruleResults
        .flatMap((result) => result.violations)
        .filter((violation) => violation.severity === "warning").length,
      totalInfo: ruleResults
        .flatMap((result) => result.violations)
        .filter((violation) => violation.severity === "info").length,
      passed: ruleResults.filter((result) => result.passed).length,
      failed: ruleResults.filter((result) => !result.passed).length,
      score: 0,
    },
    pageScreenshot: crawlResult.pageScreenshot,
    focusSequence: crawlResult.focusSequence,
    interactiveElements: crawlResult.interactiveElements,
    pageDimensions: crawlResult.pageDimensions,
  };
  report.summary.score = computeScore(report);
  return report;
}

async function auditBaseWithConfig(
  url: string,
  config: KeylensConfig,
): Promise<AuditReport> {
  const startedAt = Date.now();
  logger.info(`Starting deterministic Keylens audit for ${url}`);
  const crawlResult = await crawlPage(url, config);
  const rulesStartedAt = Date.now();
  const ruleResults = await runRules(crawlResult, config);
  return buildBaseReport(
    url,
    config,
    crawlResult,
    ruleResults,
    Date.now() - rulesStartedAt,
    Date.now() - startedAt,
  );
}

async function enrichAuditWithConfig(
  baseReport: AuditReport,
  config: KeylensConfig,
): Promise<AuditReport> {
  const report = structuredClone(baseReport);
  report.config = sanitizeConfig(config);
  const ai = new AIAnalyzer(config.ai);
  if (!ai.isAvailable()) return report;

  const startedAt = Date.now();
  const allViolations = report.rules.flatMap((result) => result.violations);
  const focusSequence = report.focusSequence ?? [];
  const interactiveElements = report.interactiveElements ?? [];
  const pageScreenshot = report.pageScreenshot ?? "";

  const [, focusOrderAnalysis, classifications, nameSuggestions, fiScores] =
    await Promise.all([
      ai.generateFixSuggestions(allViolations),
      ai.validateFocusOrder(
        focusSequence,
        pageScreenshot,
        report.pageDimensions,
      ),
      ai.classifyWidgets(interactiveElements),
      ai.inferAccessibleNames(
        interactiveElements,
        pageScreenshot,
        report.pageDimensions,
      ),
      ai.scoreFocusIndicatorQuality(focusSequence),
    ]);

  report.aiFocusOrderAnalysis = focusOrderAnalysis ?? undefined;
  report.widgetClassifications =
    classifications.length > 0 ? classifications : undefined;
  report.accessibleNameSuggestions =
    nameSuggestions.length > 0 ? nameSuggestions : undefined;
  report.focusIndicatorScores = fiScores.length > 0 ? fiScores : undefined;
  report.aiSummary = (await ai.generateSummary(report)) ?? undefined;
  report.timings.ai = Date.now() - startedAt;
  report.timings.total = baseReport.timings.total + report.timings.ai;
  return report;
}

/** Run crawl and deterministic rules without AI, reporters, or file output. */
export async function auditBase(
  url: string,
  options: AuditOptions | KeylensConfig = {},
): Promise<AuditReport> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, () =>
    auditBaseWithConfig(url, resolved.config),
  );
}

/** Add optional AI enrichment to an immutable deterministic report. */
export async function enrichAudit(
  baseReport: AuditReport,
  options: AIEnrichmentOptions = {},
): Promise<AuditReport> {
  const resolved = resolveEnrichmentOptions(baseReport.config, options);
  return withLogLevel(resolved.logLevel, () =>
    enrichAuditWithConfig(baseReport, resolved.config),
  );
}

/**
 * Run a complete in-memory audit. Reporter configuration is retained in the
 * effective config but output is only produced by renderAuditReport().
 */
export async function audit(
  url: string,
  options: AuditOptions | KeylensConfig = {},
): Promise<AuditReport> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, async () => {
    const baseReport = await auditBaseWithConfig(url, resolved.config);
    return enrichAuditWithConfig(baseReport, resolved.config);
  });
}

/** Explicitly render or write configured report formats. */
export async function renderAuditReport(
  report: AuditReport,
  reporters: ReporterType[],
  outputDir: string,
  logLevel: LogLevel = "silent",
): Promise<void> {
  await withLogLevel(logLevel, () =>
    runReporters(report, reporters, outputDir),
  );
}

/** Explicitly render or write configured multi-page report formats. */
export async function renderMultiPageReport(
  report: MultiPageReport,
  reporters: ReporterType[],
  outputDir: string,
  logLevel: LogLevel = "silent",
): Promise<void> {
  await withLogLevel(logLevel, () =>
    runMultiReporters(report, reporters, outputDir),
  );
}

function buildMultiPageReport(
  urls: string[],
  pages: AuditReport[],
  startedAt: number,
): MultiPageReport {
  const pagesDuration = pages.reduce(
    (total, page) => total + page.timings.total,
    0,
  );
  return {
    schemaVersion: AUDIT_REPORT_SCHEMA_VERSION,
    version: VERSION,
    timestamp: new Date().toISOString(),
    urls,
    pages,
    timings: {
      pages: pagesDuration,
      total: Date.now() - startedAt,
    },
    summary: {
      totalPages: pages.length,
      totalErrors: pages.reduce(
        (total, page) => total + page.summary.totalErrors,
        0,
      ),
      totalWarnings: pages.reduce(
        (total, page) => total + page.summary.totalWarnings,
        0,
      ),
      totalInfo: pages.reduce(
        (total, page) => total + page.summary.totalInfo,
        0,
      ),
      pagesWithErrors: pages.filter((page) => page.summary.totalErrors > 0)
        .length,
      score:
        pages.length > 0
          ? Math.round(
              pages.reduce((total, page) => total + page.summary.score, 0) /
                pages.length,
            )
          : 0,
    },
  };
}

async function auditMultipleBaseWithConfig(
  urls: string[],
  config: KeylensConfig,
): Promise<MultiPageReport> {
  const startedAt = Date.now();
  const pages: AuditReport[] = [];
  for (const url of urls) {
    pages.push(await auditBaseWithConfig(url, config));
  }
  return buildMultiPageReport(urls, pages, startedAt);
}

async function enrichMultiPageAuditWithConfig(
  baseReport: MultiPageReport,
  config: KeylensConfig,
): Promise<MultiPageReport> {
  const report = structuredClone(baseReport);
  const ai = new AIAnalyzer(config.ai);
  if (!ai.isAvailable()) return report;

  const startedAt = Date.now();
  const pages: AuditReport[] = [];
  for (const page of report.pages) {
    pages.push(await enrichAuditWithConfig(page, config));
  }
  report.pages = pages;

  const crossPagePatterns = await ai.detectCrossPagePatterns(report);
  report.crossPagePatterns =
    crossPagePatterns.length > 0 ? crossPagePatterns : undefined;
  report.aiSummary = (await ai.generateMultiPageSummary(report)) ?? undefined;
  report.timings.ai = Date.now() - startedAt;
  report.timings.total = baseReport.timings.total + report.timings.ai;
  return report;
}

/** Run deterministic audits for multiple URLs without enrichment or output. */
export async function auditMultipleBase(
  urls: string[],
  options: AuditOptions | KeylensConfig = {},
): Promise<MultiPageReport> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, () =>
    auditMultipleBaseWithConfig(urls, resolved.config),
  );
}

/** Add per-page and cross-page AI enrichment without mutating the base report. */
export async function enrichMultiPageAudit(
  baseReport: MultiPageReport,
  options: AIEnrichmentOptions = {},
): Promise<MultiPageReport> {
  const firstPageConfig = baseReport.pages[0]?.config;
  if (!firstPageConfig) return structuredClone(baseReport);
  const resolved = resolveEnrichmentOptions(firstPageConfig, options);
  return withLogLevel(resolved.logLevel, () =>
    enrichMultiPageAuditWithConfig(baseReport, resolved.config),
  );
}

/** Run multiple in-memory audits. Output remains an explicit caller action. */
export async function auditMultiple(
  urls: string[],
  options: AuditOptions | KeylensConfig = {},
): Promise<MultiPageReport> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, async () => {
    const baseReport = await auditMultipleBaseWithConfig(urls, resolved.config);
    return enrichMultiPageAuditWithConfig(baseReport, resolved.config);
  });
}

/** Lightweight crawl-only path used by specialized experimental adapters. */
export async function crawlOnly(
  url: string,
  options: AuditOptions | KeylensConfig = {},
): Promise<CrawlResult> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, () => crawlPage(url, resolved.config));
}

// Re-export types and utilities for programmatic use
export type {
  AuditReport,
  MultiPageReport,
  KeylensConfig,
  KeylensConfigInput,
  AIConfigInput,
  AIEnrichmentOptions,
  AuditOptions,
  AuditEvent,
  AuditAsset,
  AssetProjectionMode,
  CaptureConfig,
  CaptureLimits,
  PageCaptureMode,
  PhaseTimeoutConfig,
  AuditPhase,
  AuditAssetType,
  AuditAssetStorage,
  AuditReportSchemaVersion,
  EffectiveAIConfig,
  EffectiveKeylensConfig,
  AuditTimings,
  MultiPageAuditTimings,
  LogLevel,
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

export { AUDIT_REPORT_SCHEMA_VERSION } from "./types/index.js";
export { DEFAULT_CONFIG, normalizeConfig } from "./utils/config.js";
export { AIAnalyzer } from "./ai/index.js";
export {
  KeylensError,
  CrawlError,
  ConfigError,
  NavigationError,
} from "./errors.js";
export type { KeylensErrorCode, KeylensErrorOptions } from "./errors.js";
