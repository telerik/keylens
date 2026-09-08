/**
 * Builds the exact, allow-listed Call-Home event payload Keylens ever
 * sends. This is the single choke point that enforces the "anonymous,
 * aggregate, non-PII" data policy — every field here is a fixed enum,
 * boolean, count, or the one-way machine-id hash. There is no free-text
 * field, so there is nothing to sanitize and nothing that can
 * accidentally carry a URL, page HTML, a selector, an accessible name, a
 * screenshot, a report, an IP address, or any other identifier/content
 * from the audited page.
 *
 * If you need a new field, add it explicitly here — never spread an
 * arbitrary object (config, error, report) onto the payload.
 */

import { randomUUID } from "crypto";
import type { AuditReport, KeylensConfig } from "../types/index.js";
import type { KeylensErrorCode } from "../errors.js";
import type { SourceValue } from "./constants.js";

const PRODUCT_NAME = "Keylens";
/** Event `Type` — all Keylens event types are prefixed per convention. */
const EVENT_TYPE = "KeylensUsed";

/**
 * Run-level outcome. Mirrors the CLI's three-way exit code semantics
 * (0 success / 1 violations found / 2 incomplete) rather than the
 * accessibility verdict — a page full of violations is still a
 * "success" here because the audit itself completed.
 */
const AuditTelemetryResult = {
  Success: "success",
  Partial: "partial",
  Failure: "failure",
  Aborted: "aborted",
  Timeout: "timeout",
} as const;
type AuditTelemetryResultValue =
  (typeof AuditTelemetryResult)[keyof typeof AuditTelemetryResult];

export type CallHomeFieldValue = string | number | boolean;
export type CallHomeEvent = Record<string, CallHomeFieldValue>;

interface Envelope {
  source: SourceValue;
  machineId: string;
  isInternalUsage: boolean;
}

function buildEnvelope(envelope: Envelope): CallHomeEvent {
  return {
    Type: EVENT_TYPE,
    Source: envelope.source,
    SessionId: randomUUID(),
    Timestamp: new Date().toISOString(),
    ProductName: PRODUCT_NAME,
    MachineId: envelope.machineId,
    IsInternalUsage: envelope.isInternalUsage,
    NodeVersion: process.version,
    OsPlatform: process.platform,
  };
}

/** Categorical config knobs only — never url, waitForSelector, outputDir, dismissSelectors, cookies, or steps. */
function buildConfigFields(config: KeylensConfig): CallHomeEvent {
  const enabledRules = Object.values(config.rules).filter(Boolean).length;
  return {
    Profile: config.profile,
    Browser: config.browser,
    Headed: config.headed,
    MaxTabs: config.maxTabs,
    TabDelay: config.tabDelay,
    Viewport: `${config.viewport.width}x${config.viewport.height}`,
    Reporters: [...config.reporters].sort().join(","),
    CapturePage: config.capture.page,
    InteractionsEnabled: config.interactions.enabled,
    PrepareDismissOverlays: config.prepare.dismissOverlays,
    PrepareExpandScrollContainers: config.prepare.expandScrollContainers,
    RulesEnabledCount: enabledRules,
    RulesTotalCount: Object.values(config.rules).length,
  };
}

/** Per-rule pass/fail/error status and violation counts, keyed by the fixed, known rule id vocabulary. */
function buildRuleFields(report: AuditReport): CallHomeEvent {
  const fields: CallHomeEvent = {};
  for (const result of report.rules) {
    const status = result.status ?? (result.passed ? "passed" : "failed");
    const key = pascalCase(result.ruleId);
    fields[`Rule${key}Status`] = status;
    fields[`Rule${key}Violations`] = result.violations.length;
  }
  return fields;
}

function pascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function buildSuccessEvent(
  report: AuditReport,
  envelope: Envelope,
): CallHomeEvent {
  const result: AuditTelemetryResultValue = report.summary.scoreComplete
    ? AuditTelemetryResult.Success
    : AuditTelemetryResult.Partial;

  return {
    ...buildEnvelope(envelope),
    KeylensVersion: report.version,
    Result: result,
    AuditDurationMs: Math.round(report.timings.total),
    Score: report.summary.score,
    ScoreComplete: report.summary.scoreComplete,
    TotalErrors: report.summary.totalErrors,
    TotalWarnings: report.summary.totalWarnings,
    TotalInfo: report.summary.totalInfo,
    RulesPassed: report.summary.passed,
    RulesFailed: report.summary.failed,
    RulesErrored: report.summary.errors,
    CrawlTotalFocusableElements: report.crawl.totalFocusableElements,
    CrawlTotalInteractiveElements: report.crawl.totalInteractiveElements,
    CrawlUnreachedElements: report.crawl.unreachedElements,
    CrawlCycleCompleted: report.crawl.cycleCompleted,
    ...buildConfigFields(report.config),
    ...buildRuleFields(report),
  };
}

function errorCode(error: unknown): KeylensErrorCode {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code as KeylensErrorCode;
  }
  return "INTERNAL_ERROR";
}

export function buildFailureEvent(
  version: string,
  error: unknown,
  envelope: Envelope,
): CallHomeEvent {
  const code = errorCode(error);
  const result: AuditTelemetryResultValue =
    code === "ABORTED"
      ? AuditTelemetryResult.Aborted
      : code === "TIMEOUT"
        ? AuditTelemetryResult.Timeout
        : AuditTelemetryResult.Failure;

  return {
    ...buildEnvelope(envelope),
    KeylensVersion: version,
    Result: result,
    ErrorCode: code,
  };
}
