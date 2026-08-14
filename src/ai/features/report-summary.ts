import type {
  AuditReport,
  MultiPageReport,
  AIReportSummary,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { throwIfAborted } from "../../utils/execution.js";
import { safeParseJSON, reportSummarySchema } from "../schemas.js";
import type { AIFeatureContext } from "../provider.js";

/**
 * Generate an executive summary of the audit report.
 * Returns structured AIReportSummary when possible, falls back to string.
 */
export async function generateSummary(
  ctx: AIFeatureContext,
  report: AuditReport,
): Promise<string | AIReportSummary | null> {
  logger.info("Generating AI report summary...");

  const violationDetails = report.rules
    .filter((r) => r.status !== "error" && !r.passed)
    .flatMap((r) => r.violations)
    .map(
      (v) =>
        `- [${v.severity}] ${v.ruleName}: ${v.message} (${v.elements.length} element(s))`,
    )
    .join("\n");

  const prompt = `You are an accessibility consultant producing a structured summary of a keyboard navigation audit.

URL: ${report.url}
Focusable elements: ${report.crawl.totalFocusableElements}
Interactive elements: ${report.crawl.totalInteractiveElements}
Unreached elements: ${report.crawl.unreachedElements}
Tab cycle completed: ${report.crawl.cycleCompleted}
Errors: ${report.summary.totalErrors}
Warnings: ${report.summary.totalWarnings}
Rule evaluation errors: ${report.summary.errors ?? 0}
Score complete: ${report.summary.scoreComplete !== false}

Rule results:
${report.rules
  .map(
    (r) =>
      `- ${r.ruleId}: ${
        r.status === "error"
          ? `NOT EVALUATED (${r.error?.message ?? "evaluation error"})`
          : r.passed
            ? "PASSED"
            : `FAILED (${r.violations.length} issues)`
      }`,
  )
  .join("\n")}
${violationDetails ? `\nViolation details:\n${violationDetails}` : ""}

Respond with ONLY a JSON object matching this schema:
{
  "overview": "2-3 sentence overall assessment for non-technical stakeholders",
  "criticalIssues": ["most critical issue 1", "critical issue 2"],
  "prioritizedFixes": [
    { "fix": "what to do", "effort": "low"|"medium"|"high", "impact": "high"|"medium"|"low" }
  ],
  "aiSeverityRating": <1-100 integer>,
  "recommendation": "one-sentence next step recommendation"
}

Score guide: 90-100 excellent, 70-89 good, 50-69 needs work, below 50 critical issues.
If you cannot produce valid JSON, provide a concise 3-4 sentence summary as plain text.`;

  try {
    const response = await ctx.provider.query(prompt);

    const parsed = safeParseJSON(response, reportSummarySchema);
    if (parsed) {
      return parsed;
    }

    return response;
  } catch (error) {
    throwIfAborted(ctx.signal, "ai");
    logger.debug(`AI summary generation failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Generate a cross-page executive summary for multi-page audits.
 * Aggregates per-page results and identifies cross-page themes.
 */
export async function generateMultiPageSummary(
  ctx: AIFeatureContext,
  report: MultiPageReport,
): Promise<string | AIReportSummary | null> {
  logger.info("Generating AI multi-page summary...");

  const pageOverviews = report.pages
    .map(
      (p) =>
        `- ${p.url}: ${p.summary.totalErrors} errors, ${p.summary.totalWarnings} warnings, ${p.crawl.totalFocusableElements} focusable elements`,
    )
    .join("\n");

  const crossPageIssues = report.crossPagePatterns
    ? report.crossPagePatterns
        .map((cp) => `- [${cp.type}] ${cp.description}`)
        .join("\n")
    : "";

  const prompt = `You are an accessibility consultant producing a structured summary of a multi-page keyboard navigation audit.

Pages audited: ${report.summary.totalPages}
Total errors: ${report.summary.totalErrors}
Total warnings: ${report.summary.totalWarnings}
Rule evaluation errors: ${report.summary.ruleErrors ?? 0}
Score complete: ${report.summary.scoreComplete !== false}
Pages with errors: ${report.summary.pagesWithErrors}

Per-page breakdown:
${pageOverviews}
${crossPageIssues ? `\nCross-page issues detected:\n${crossPageIssues}` : ""}

Respond with ONLY a JSON object matching this schema:
{
  "overview": "2-3 sentence overall assessment across all pages",
  "criticalIssues": ["site-wide critical issue 1", "critical issue 2"],
  "prioritizedFixes": [
    { "fix": "what to do site-wide", "effort": "low"|"medium"|"high", "impact": "high"|"medium"|"low" }
  ],
  "aiSeverityRating": <1-100 integer>,
  "recommendation": "one-sentence next step recommendation for the entire site"
}

Score guide: 90-100 excellent, 70-89 good, 50-69 needs work, below 50 critical issues.
If you cannot produce valid JSON, provide a concise 3-4 sentence summary as plain text.`;

  try {
    const response = await ctx.provider.query(prompt);

    const parsed = safeParseJSON(response, reportSummarySchema);
    if (parsed) {
      return parsed;
    }

    return response;
  } catch (error) {
    throwIfAborted(ctx.signal, "ai");
    logger.debug(`AI multi-page summary failed: ${(error as Error).message}`);
    return null;
  }
}
