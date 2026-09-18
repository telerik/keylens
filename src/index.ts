import type {
  AuditReport,
  AuditOptions,
  KeylensConfig,
  LogLevel,
  CrawlResult,
  ReporterType,
  RenderOptions,
  RuleResult,
  AuditEvent,
} from "./types/index.js";
import { crawlPage } from "./crawler/index.js";
import { runRules } from "./rules/index.js";
import { runReporters } from "./reporters/index.js";
import { logger, withLogLevel } from "./utils/logger.js";
import { computeScore } from "./utils/score.js";
import { AUDIT_REPORT_SCHEMA_VERSION } from "./types/index.js";
import { normalizeConfig } from "./utils/config.js";
import { createExecutionScope, throwIfAborted } from "./utils/execution.js";
import { getUnreachedInteractiveElements } from "./utils/roving-tabindex.js";
import {
  recordAuditSuccess,
  recordAuditFailure,
  toCallHomeSource,
} from "./telemetry/context.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

interface ResolvedAuditOptions {
  config: KeylensConfig;
  logLevel: LogLevel;
  signal?: AbortSignal;
  onEvent?: (event: AuditEvent) => void;
  telemetryEnabled: boolean;
  telemetrySurface: "cli" | "mcp" | "library";
}

function resolveAuditOptions(
  options: AuditOptions | KeylensConfig = {},
): ResolvedAuditOptions {
  const {
    signal,
    onEvent,
    logLevel = "silent",
    telemetry = true,
    telemetrySurface = "library",
    ...configInput
  } = options as AuditOptions;
  return {
    config: normalizeConfig(configInput),
    logLevel,
    signal,
    onEvent,
    telemetryEnabled: telemetry,
    telemetrySurface,
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
  url?: string,
): void {
  controls.onEvent?.({
    type,
    phase,
    url,
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

function sanitizeConfig(config: KeylensConfig): KeylensConfig {
  return structuredClone(config);
}

function projectFocusSequence(
  focusSequence: CrawlResult["focusSequence"],
): AuditReport["focusSequence"] {
  return focusSequence.map(
    ({
      focusedStyleSnapshot: _focused,
      unfocusedStyleSnapshot: _unfocused,
      ...element
    }) => element,
  );
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
      unreachedElements: getUnreachedInteractiveElements(
        crawlResult.interactiveElements,
      ).length,
      cycleCompleted: crawlResult.cycleCompleted,
      duration: crawlResult.crawlDuration,
      interactions: crawlResult.interactionSummary,
      prepare: crawlResult.prepare,
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
    focusSequence: projectFocusSequence(crawlResult.focusSequence),
    interactiveElements: crawlResult.interactiveElements,
    interactionResults: crawlResult.interactionResults,
    rovingTabindexGroups: crawlResult.rovingTabindexGroups,
    pageDimensions: crawlResult.pageDimensions,
  };
  report.summary.score = computeScore(report);
  return report;
}

async function auditBaseWithConfig(
  url: string,
  config: KeylensConfig,
  controls: ExecutionControls,
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
    emitPhase(controls, "phase-started", "crawl", url);
    crawlResult = await crawlPage(
      url,
      config,
      crawlScope.signal,
      undefined,
      controls.onEvent,
      controls.startedAt,
    );
    throwIfAborted(crawlScope.signal, "crawl", url);
    emitPhase(controls, "phase-completed", "crawl", url);
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
    emitPhase(controls, "phase-started", "rules", url);
    ruleResults = await runRules(
      crawlResult,
      config,
      rulesScope.signal,
      controls.onEvent,
      controls.startedAt,
    );
    throwIfAborted(rulesScope.signal, "rules", url);
    emitPhase(controls, "phase-completed", "rules", url);
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

/** Run a complete in-memory audit. Output is only produced by renderAuditReport(). */
export async function audit(
  url: string,
  options: AuditOptions | KeylensConfig = {},
): Promise<AuditReport> {
  const resolved = resolveAuditOptions(options);
  const source = toCallHomeSource(resolved.telemetrySurface);
  try {
    const report = await withLogLevel(resolved.logLevel, () =>
      withTotalBudget(resolved.config, resolved, url, (controls) =>
        auditBaseWithConfig(url, resolved.config, controls),
      ),
    );
    await recordAuditSuccess(report, source, resolved.telemetryEnabled);
    return report;
  } catch (error) {
    await recordAuditFailure(error, VERSION, source, resolved.telemetryEnabled);
    throw error;
  }
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
        return await crawlPage(
          url,
          resolved.config,
          scope.signal,
          undefined,
          controls.onEvent,
          controls.startedAt,
        );
      } finally {
        scope.dispose();
      }
    }),
  );
}

// Re-export types and utilities for programmatic use
export type {
  AuditReport,
  KeylensConfig,
  KeylensConfigInput,
  RenderOptions,
  AuditOptions,
  AuditEvent,
  AuditAsset,
  AssetProjectionMode,
  AssetProjectionOptions,
  CaptureConfig,
  CaptureLimits,
  CaptureSummary,
  ExecutionProfile,
  PageCaptureMode,
  PhaseTimeoutConfig,
  AuditPhase,
  AuditAssetType,
  AuditAssetStorage,
  AuditReportSchemaVersion,
  AuditTimings,
  LogLevel,
  RuleConfig,
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
  SkipLinkResult,
  RuleRemediation,
  WcagReference,
} from "./types/index.js";

export { AUDIT_REPORT_SCHEMA_VERSION } from "./types/index.js";
export {
  DEFAULT_CONFIG,
  EXECUTION_PROFILES,
  KEYLENS_CONFIG_INPUT_SCHEMA,
  normalizeConfig,
  validateConfigInput,
} from "./utils/config.js";
export {
  RULE_CATALOG,
  getRuleCatalog,
  getRuleRemediation,
  getWcagReference,
} from "./guidance.js";
export {
  renderHTML,
  renderMarkdown,
  serializeJSON,
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
export { projectAuditReport } from "./utils/assets.js";
export type { KeylensErrorCode, KeylensErrorOptions } from "./errors.js";
export {
  ENV_KEYLENS_TELEMETRY_OFF,
  ENV_TELERIK_TELEMETRY_OFF,
} from "./telemetry/constants.js";
