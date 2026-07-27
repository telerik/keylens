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
  RenderOptions,
  RuleResult,
  AuditEvent,
} from "./types/index.js";
import type { Browser } from "playwright";
import { crawlPage, launchAuditBrowser } from "./crawler/index.js";
import { runRules } from "./rules/index.js";
import { runMultiReporters, runReporters } from "./reporters/index.js";
import { AIAnalyzer } from "./ai/index.js";
import { logger, withLogLevel } from "./utils/logger.js";
import { computeScore } from "./utils/score.js";
import {
  cloneAuditReport,
  cloneMultiPageReport,
  getInlineAssetData,
} from "./utils/assets.js";
import { AUDIT_REPORT_SCHEMA_VERSION } from "./types/index.js";
import { hasConfiguredAIAPIKey, normalizeConfig } from "./utils/config.js";
import { createExecutionScope, throwIfAborted } from "./utils/execution.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

interface ResolvedAuditOptions {
  config: KeylensConfig;
  logLevel: LogLevel;
  signal?: AbortSignal;
  onEvent?: (event: AuditEvent) => void;
}

function resolveAuditOptions(
  options: AuditOptions | KeylensConfig = {},
): ResolvedAuditOptions {
  const {
    signal,
    onEvent,
    logLevel = "silent",
    ...configInput
  } = options as AuditOptions;
  return {
    config: normalizeConfig(configInput),
    logLevel,
    signal,
    onEvent,
  };
}

function resolveEnrichmentOptions(
  baseConfig: EffectiveKeylensConfig,
  options: AIEnrichmentOptions = {},
): ResolvedAuditOptions {
  const { signal, onEvent, logLevel = "silent", ai: aiOverrides } = options;
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
    signal,
    onEvent,
  };
}

interface ExecutionControls {
  signal?: AbortSignal;
  onEvent?: (event: AuditEvent) => void;
  startedAt: number;
}

function emitPhase(
  controls: ExecutionControls,
  type: "phase-started" | "phase-completed",
  phase: AuditEvent["phase"],
): void {
  controls.onEvent?.({
    type,
    phase,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - controls.startedAt,
  });
}

async function withTotalBudget<T>(
  config: KeylensConfig,
  controls: Omit<ExecutionControls, "startedAt">,
  url: string | undefined,
  operation: (controls: ExecutionControls) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const scope = createExecutionScope({
    parentSignal: controls.signal,
    timeout: config.timeouts.total,
    phase: "setup",
    url,
    timeoutKind: "total",
  });
  try {
    throwIfAborted(scope.signal, "setup", url);
    return await operation({ ...controls, signal: scope.signal, startedAt });
  } finally {
    scope.dispose();
  }
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
  const ruleStatus = (result: RuleResult) =>
    result.status ?? (result.passed ? "passed" : "failed");
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
      interactions: crawlResult.interactionSummary,
      capture: crawlResult.capture,
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
      passed: ruleResults.filter((result) => ruleStatus(result) === "passed")
        .length,
      failed: ruleResults.filter((result) => ruleStatus(result) === "failed")
        .length,
      errors: ruleResults.filter((result) => ruleStatus(result) === "error")
        .length,
      score: 0,
      scoreComplete: ruleResults.every(
        (result) => ruleStatus(result) !== "error",
      ),
    },
    pageScreenshotAssetId: crawlResult.pageScreenshotAssetId,
    assets: crawlResult.assets,
    focusSequence: crawlResult.focusSequence,
    interactiveElements: crawlResult.interactiveElements,
    interactionResults: crawlResult.interactionResults,
    pageDimensions: crawlResult.pageDimensions,
  };
  report.summary.score = computeScore(report);
  return report;
}

async function auditBaseWithConfig(
  url: string,
  config: KeylensConfig,
  controls: ExecutionControls,
  sharedBrowser?: Browser,
): Promise<AuditReport> {
  const startedAt = Date.now();
  logger.info(`Starting deterministic Keylens audit for ${url}`);
  const crawlScope = createExecutionScope({
    parentSignal: controls.signal,
    timeout: config.timeouts.crawl,
    phase: "crawl",
    url,
  });
  let crawlResult: CrawlResult;
  try {
    emitPhase(controls, "phase-started", "crawl");
    crawlResult = await crawlPage(
      url,
      config,
      crawlScope.signal,
      sharedBrowser,
    );
    throwIfAborted(crawlScope.signal, "crawl", url);
    emitPhase(controls, "phase-completed", "crawl");
  } finally {
    crawlScope.dispose();
  }

  const rulesStartedAt = Date.now();
  const rulesScope = createExecutionScope({
    parentSignal: controls.signal,
    timeout: config.timeouts.rules,
    phase: "rules",
    url,
  });
  let ruleResults: RuleResult[];
  try {
    emitPhase(controls, "phase-started", "rules");
    ruleResults = await runRules(crawlResult, config, rulesScope.signal);
    throwIfAborted(rulesScope.signal, "rules", url);
    emitPhase(controls, "phase-completed", "rules");
  } finally {
    rulesScope.dispose();
  }
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
  controls: ExecutionControls,
): Promise<AuditReport> {
  const report = cloneAuditReport(baseReport);
  report.config = sanitizeConfig(config);
  const aiScope = createExecutionScope({
    parentSignal: controls.signal,
    timeout: config.timeouts.ai,
    phase: "ai",
    url: report.url,
  });
  const ai = new AIAnalyzer(config.ai, aiScope.signal);
  if (!ai.isAvailable()) {
    aiScope.dispose();
    return report;
  }
  const startedAt = Date.now();
  const allViolations = report.rules.flatMap((result) => result.violations);
  const focusSequence = report.focusSequence ?? [];
  const interactiveElements = report.interactiveElements ?? [];
  const pageScreenshot =
    getInlineAssetData(report.assets, report.pageScreenshotAssetId) ?? "";

  try {
    emitPhase(controls, "phase-started", "ai");
    const [
      fixResult,
      focusOrderResult,
      classificationsResult,
      nameSuggestionsResult,
      fiScoresResult,
    ] = await Promise.allSettled([
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
      ai.scoreFocusIndicatorQuality(focusSequence, report.assets),
    ] as const);
    unwrapSettled(fixResult);
    const focusOrderAnalysis = unwrapSettled(focusOrderResult);
    const classifications = unwrapSettled(classificationsResult);
    const nameSuggestions = unwrapSettled(nameSuggestionsResult);
    const fiScores = unwrapSettled(fiScoresResult);

    throwIfAborted(aiScope.signal, "ai", report.url);
    report.aiFocusOrderAnalysis = focusOrderAnalysis ?? undefined;
    report.widgetClassifications =
      classifications.length > 0 ? classifications : undefined;
    report.accessibleNameSuggestions =
      nameSuggestions.length > 0 ? nameSuggestions : undefined;
    report.focusIndicatorScores = fiScores.length > 0 ? fiScores : undefined;
    report.aiSummary = (await ai.generateSummary(report)) ?? undefined;
    throwIfAborted(aiScope.signal, "ai", report.url);
    report.timings.ai = Date.now() - startedAt;
    report.timings.total = baseReport.timings.total + report.timings.ai;
    emitPhase(controls, "phase-completed", "ai");
    return report;
  } finally {
    aiScope.dispose();
  }
}

function unwrapSettled<T>(result: PromiseSettledResult<T>): T {
  if (result.status === "rejected") throw result.reason;
  return result.value;
}

/** Run crawl and deterministic rules without AI, reporters, or file output. */
export async function auditBase(
  url: string,
  options: AuditOptions | KeylensConfig = {},
): Promise<AuditReport> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, () =>
    withTotalBudget(resolved.config, resolved, url, (controls) =>
      auditBaseWithConfig(url, resolved.config, controls),
    ),
  );
}

/** Add optional AI enrichment to an immutable deterministic report. */
export async function enrichAudit(
  baseReport: AuditReport,
  options: AIEnrichmentOptions = {},
): Promise<AuditReport> {
  const resolved = resolveEnrichmentOptions(baseReport.config, options);
  return withLogLevel(resolved.logLevel, () =>
    withTotalBudget(resolved.config, resolved, baseReport.url, (controls) =>
      enrichAuditWithConfig(baseReport, resolved.config, controls),
    ),
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
    return withTotalBudget(resolved.config, resolved, url, async (controls) => {
      const baseReport = await auditBaseWithConfig(
        url,
        resolved.config,
        controls,
      );
      return enrichAuditWithConfig(baseReport, resolved.config, controls);
    });
  });
}

/** Explicitly render or write configured report formats. */
export async function renderAuditReport(
  report: AuditReport,
  reporters: ReporterType[],
  outputDir: string,
  options: LogLevel | RenderOptions = "silent",
): Promise<void> {
  const resolved =
    typeof options === "string" ? { logLevel: options } : options;
  await withLogLevel(resolved.logLevel ?? "silent", async () => {
    const scope = createExecutionScope({
      parentSignal: resolved.signal,
      timeout: resolved.timeout ?? report.config.timeouts.reporters,
      phase: "reporters",
      url: report.url,
    });
    try {
      await runReporters(report, reporters, outputDir, scope.signal);
    } finally {
      scope.dispose();
    }
  });
}

/** Explicitly render or write configured multi-page report formats. */
export async function renderMultiPageReport(
  report: MultiPageReport,
  reporters: ReporterType[],
  outputDir: string,
  options: LogLevel | RenderOptions = "silent",
): Promise<void> {
  const resolved =
    typeof options === "string" ? { logLevel: options } : options;
  await withLogLevel(resolved.logLevel ?? "silent", async () => {
    const scope = createExecutionScope({
      parentSignal: resolved.signal,
      timeout: resolved.timeout ?? report.pages[0]?.config.timeouts.reporters,
      phase: "reporters",
    });
    try {
      await runMultiReporters(report, reporters, outputDir, scope.signal);
    } finally {
      scope.dispose();
    }
  });
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
      ruleErrors: pages.reduce(
        (total, page) => total + (page.summary.errors ?? 0),
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
      scoreComplete: pages.every(
        (page) => page.summary.scoreComplete !== false,
      ),
    },
  };
}

async function auditMultipleBaseWithConfig(
  urls: string[],
  config: KeylensConfig,
  controls: ExecutionControls,
): Promise<MultiPageReport> {
  const startedAt = Date.now();
  if (urls.length === 0) return buildMultiPageReport(urls, [], startedAt);

  const browser = await launchAuditBrowser(config, controls.signal);
  const pages = new Array<AuditReport>(urls.length);
  let nextIndex = 0;
  let firstError: unknown;

  const worker = async () => {
    while (firstError === undefined) {
      const index = nextIndex++;
      if (index >= urls.length) return;
      try {
        pages[index] = await auditBaseWithConfig(
          urls[index]!,
          config,
          controls,
          browser,
        );
      } catch (error) {
        if (firstError === undefined) firstError = error;
      }
    }
  };

  try {
    const workerCount = Math.min(config.multiPage.concurrency, urls.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    if (firstError !== undefined) throw firstError;
    return buildMultiPageReport(urls, pages, startedAt);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function enrichMultiPageAuditWithConfig(
  baseReport: MultiPageReport,
  config: KeylensConfig,
  controls: ExecutionControls,
): Promise<MultiPageReport> {
  const report = cloneMultiPageReport(baseReport);
  const aiScope = createExecutionScope({
    parentSignal: controls.signal,
    timeout: config.timeouts.ai,
    phase: "ai",
  });
  const scopedControls = { ...controls, signal: aiScope.signal };
  const ai = new AIAnalyzer(config.ai, aiScope.signal);
  if (!ai.isAvailable()) {
    aiScope.dispose();
    return report;
  }

  const startedAt = Date.now();
  try {
    const pages: AuditReport[] = [];
    for (const page of report.pages) {
      pages.push(await enrichAuditWithConfig(page, config, scopedControls));
    }
    report.pages = pages;

    const crossPagePatterns = await ai.detectCrossPagePatterns(report);
    throwIfAborted(aiScope.signal, "ai");
    report.crossPagePatterns =
      crossPagePatterns.length > 0 ? crossPagePatterns : undefined;
    report.aiSummary = (await ai.generateMultiPageSummary(report)) ?? undefined;
    throwIfAborted(aiScope.signal, "ai");
    report.timings.ai = Date.now() - startedAt;
    report.timings.total = baseReport.timings.total + report.timings.ai;
    return report;
  } finally {
    aiScope.dispose();
  }
}

/** Run deterministic audits for multiple URLs without enrichment or output. */
export async function auditMultipleBase(
  urls: string[],
  options: AuditOptions | KeylensConfig = {},
): Promise<MultiPageReport> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, () =>
    withTotalBudget(resolved.config, resolved, undefined, (controls) =>
      auditMultipleBaseWithConfig(urls, resolved.config, controls),
    ),
  );
}

/** Add per-page and cross-page AI enrichment without mutating the base report. */
export async function enrichMultiPageAudit(
  baseReport: MultiPageReport,
  options: AIEnrichmentOptions = {},
): Promise<MultiPageReport> {
  const firstPageConfig = baseReport.pages[0]?.config;
  if (!firstPageConfig) return cloneMultiPageReport(baseReport);
  const resolved = resolveEnrichmentOptions(firstPageConfig, options);
  return withLogLevel(resolved.logLevel, () =>
    withTotalBudget(resolved.config, resolved, undefined, (controls) =>
      enrichMultiPageAuditWithConfig(baseReport, resolved.config, controls),
    ),
  );
}

/** Run multiple in-memory audits. Output remains an explicit caller action. */
export async function auditMultiple(
  urls: string[],
  options: AuditOptions | KeylensConfig = {},
): Promise<MultiPageReport> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, async () => {
    return withTotalBudget(
      resolved.config,
      resolved,
      undefined,
      async (controls) => {
        const baseReport = await auditMultipleBaseWithConfig(
          urls,
          resolved.config,
          controls,
        );
        return enrichMultiPageAuditWithConfig(
          baseReport,
          resolved.config,
          controls,
        );
      },
    );
  });
}

/** Lightweight crawl-only path used by specialized experimental adapters. */
export async function crawlOnly(
  url: string,
  options: AuditOptions | KeylensConfig = {},
): Promise<CrawlResult> {
  const resolved = resolveAuditOptions(options);
  return withLogLevel(resolved.logLevel, () =>
    withTotalBudget(resolved.config, resolved, url, async (controls) => {
      const scope = createExecutionScope({
        parentSignal: controls.signal,
        timeout: resolved.config.timeouts.crawl,
        phase: "crawl",
        url,
      });
      try {
        return await crawlPage(url, resolved.config, scope.signal);
      } finally {
        scope.dispose();
      }
    }),
  );
}

// Re-export types and utilities for programmatic use
export type {
  AuditReport,
  MultiPageReport,
  KeylensConfig,
  KeylensConfigInput,
  AIConfigInput,
  AIEnrichmentOptions,
  RenderOptions,
  AuditOptions,
  AuditEvent,
  AuditAsset,
  AssetProjectionMode,
  AssetProjectionOptions,
  CaptureConfig,
  CaptureLimits,
  CaptureSummary,
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
  InteractionSummary,
  InteractionConfig,
  InteractionAction,
  InteractionIsolation,
  InteractionNavigationPolicy,
  MultiPageConfig,
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
  renderHTML,
  renderMultiHTML,
  renderMarkdown,
  renderMultiMarkdown,
  serializeJSON,
  serializeMultiJSON,
} from "./reporters/index.js";
export {
  KeylensError,
  CrawlError,
  ConfigError,
  NavigationError,
  AuditAbortedError,
  AuditTimeoutError,
  ReporterError,
} from "./errors.js";
export { projectAuditReport, projectMultiPageReport } from "./utils/assets.js";
export type { KeylensErrorCode, KeylensErrorOptions } from "./errors.js";
