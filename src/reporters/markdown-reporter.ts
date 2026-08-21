import type {
  AuditReport,
  FixSuggestion,
  AIFocusOrderResult,
  AIReportSummary,
} from "../types/index.js";
import { writeReportFile } from "../utils/report-writer.js";

// ─── Helpers ─────────────────────────────────────────────────────

/** Escape pipe characters and newlines so they don't break markdown tables. */
function esc(str: string): string {
  return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Truncate a string to `max` characters, appending an ellipsis if truncated. */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

/** Format milliseconds as a human-readable duration. */
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ─── Single-page sections ────────────────────────────────────────

function renderHeader(report: AuditReport): string {
  const lines: string[] = [];
  lines.push("# Keylens Keyboard Navigation Report");
  lines.push("");
  lines.push(`- **URL:** ${report.url}`);
  lines.push(`- **Version:** ${report.version}`);
  lines.push(`- **Timestamp:** ${report.timestamp}`);
  lines.push("");
  return lines.join("\n");
}

function renderSummary(report: AuditReport): string {
  const s = report.summary;
  const lines: string[] = [];
  lines.push("## Summary");
  lines.push("");
  lines.push(
    "| Errors | Warnings | Info | Rules Passed | Rules Failed | Rule Errors | Score |",
  );
  lines.push(
    "| ------ | -------- | ---- | ------------ | ------------ | ----------- | ----- |",
  );
  lines.push(
    `| ${s.totalErrors} | ${s.totalWarnings} | ${s.totalInfo} | ${s.passed} | ${s.failed} | ${s.errors ?? 0} | ${s.score}/100${s.scoreComplete === false ? " (incomplete)" : ""} |`,
  );
  lines.push("");
  return lines.join("\n");
}

function renderCrawl(report: AuditReport): string {
  const c = report.crawl;
  const lines: string[] = [];
  lines.push("## Crawl");
  lines.push("");
  lines.push(
    "| Focusable Elements | Interactive Elements | Unreached | Cycle Completed | Duration |",
  );
  lines.push(
    "| ------------------ | -------------------- | --------- | --------------- | -------- |",
  );
  lines.push(
    `| ${c.totalFocusableElements} | ${c.totalInteractiveElements} | ${c.unreachedElements} | ${c.cycleCompleted ? "Yes" : "No"} | ${fmtDuration(c.duration)} |`,
  );
  lines.push("");
  if (c.prepare?.dismissals.length) {
    const dismissed = c.prepare.dismissals
      .map(
        (d) => `${d.provider} (${d.action}${d.verified ? "" : ", unverified"})`,
      )
      .join(", ");
    lines.push(`**Overlays dismissed:** ${dismissed}`);
    lines.push("");
  }
  if (c.prepare?.scrollContainerExpanded) {
    const { selector, originalHeight, expandedHeight } =
      c.prepare.scrollContainerExpanded;
    lines.push(
      `**Scroll container expanded:** ${selector} (${originalHeight}px -> ${expandedHeight}px)`,
    );
    lines.push("");
  }
  if (c.prepare?.warnings.length) {
    lines.push(`**Prepare warnings:** ${c.prepare.warnings.join("; ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderFocusSequence(report: AuditReport): string {
  if (!report.focusSequence || report.focusSequence.length === 0) return "";

  const elements = report.focusSequence;
  const hasAria = elements.some(
    (el) => el.ariaAttributes && Object.keys(el.ariaAttributes).length > 0,
  );
  const hasContext = elements.some((el) => el.parentContext);

  const lines: string[] = [];
  lines.push("## Focus Sequence");
  lines.push("");

  // Header row
  let header = "| # | Tag | Role | Name | Selector |";
  let separator = "| --- | --- | --- | --- | --- |";
  if (hasAria) {
    header += " ARIA Attrs |";
    separator += " --- |";
  }
  if (hasContext) {
    header += " Context |";
    separator += " --- |";
  }
  lines.push(header);
  lines.push(separator);

  for (const el of elements) {
    const name = esc(truncate(el.accessibleName || "", 50));
    const selector = esc(truncate(el.selector, 60));
    let row = `| ${el.tabIndex} | ${esc(el.tagName)} | ${esc(el.role || "")} | ${name} | \`${selector}\` |`;
    if (hasAria) {
      const attrs = el.ariaAttributes
        ? Object.entries(el.ariaAttributes)
            .map(([k, v]) => `${k}="${v}"`)
            .join(", ")
        : "";
      row += ` ${esc(attrs)} |`;
    }
    if (hasContext) {
      row += ` ${esc(el.parentContext || "")} |`;
    }
    lines.push(row);
  }

  lines.push("");
  return lines.join("\n");
}

function renderSkipLink(report: AuditReport): string {
  const skipLinkRule = report.rules.find((r) => r.ruleId === "skip-link");
  if (!skipLinkRule) return "";

  const lines: string[] = [];
  lines.push("## Skip Link");
  lines.push("");

  if (skipLinkRule.passed) {
    lines.push("Skip link: **functional.**");
  } else {
    for (const v of skipLinkRule.violations) {
      lines.push(`- **${v.severity}**: ${esc(v.message)}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function renderRules(report: AuditReport): string {
  if (report.rules.length === 0) return "";

  const lines: string[] = [];
  lines.push("## Rules");
  lines.push("");

  for (const rule of report.rules) {
    const badge =
      rule.status === "error" ? "[ERROR]" : rule.passed ? "[PASS]" : "[FAIL]";
    const title = rule.ruleName || rule.ruleId;
    lines.push(`### ${title} ${badge}`);
    lines.push("");

    if (rule.ruleDescription) {
      lines.push(rule.ruleDescription);
      lines.push("");
    }

    if (rule.wcag && rule.wcag.length > 0) {
      lines.push(`**WCAG:** ${rule.wcag.join(", ")}`);
      lines.push("");
    }

    if (rule.error) {
      lines.push(`**Evaluation error:** ${esc(rule.error.message)}`);
      lines.push("");
    }

    if (rule.violations.length > 0) {
      for (const v of rule.violations) {
        lines.push(`- **${v.severity}**: ${esc(v.message)}`);
        lines.push(`  - **Impact:** ${esc(v.impact)}`);

        if (v.elements.length > 0) {
          lines.push("  - **Elements:**");
          for (const el of v.elements) {
            const pos =
              el.tabPosition != null ? ` (tab #${el.tabPosition})` : "";
            lines.push(`    - \`${esc(truncate(el.selector, 80))}\`${pos}`);
          }
        }

        if (v.fixSuggestion) {
          renderFixSuggestion(lines, v.fixSuggestion);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function renderFixSuggestion(
  lines: string[],
  fix: string | FixSuggestion,
): void {
  if (typeof fix === "string") {
    lines.push(`  - **Fix:** ${esc(fix)}`);
    return;
  }

  lines.push(`  - **Fix:** ${esc(fix.summary)}`);
  lines.push(`    - Effort: ${fix.estimatedEffort} | WCAG: ${fix.wcagRef}`);
  lines.push(`    - ${esc(fix.explanation)}`);

  if (fix.codeBefore || fix.codeAfter) {
    if (fix.codeBefore) {
      lines.push("    ```diff");
      lines.push(
        fix.codeBefore
          .split("\n")
          .map((l) => `    - ${l}`)
          .join("\n"),
      );
      if (fix.codeAfter) {
        lines.push(
          fix.codeAfter
            .split("\n")
            .map((l) => `    + ${l}`)
            .join("\n"),
        );
      }
      lines.push("    ```");
    } else if (fix.codeAfter) {
      lines.push("    ```html");
      lines.push(`    ${fix.codeAfter}`);
      lines.push("    ```");
    }
  }
}

function renderAIAnalysis(report: AuditReport): string {
  const hasAny =
    report.aiFocusOrderAnalysis ||
    report.widgetClassifications?.length ||
    report.accessibleNameSuggestions?.length ||
    report.focusIndicatorScores?.length ||
    report.aiSummary;

  if (!hasAny) return "";

  const lines: string[] = [];
  lines.push("## AI Analysis");
  lines.push("");

  // Focus Order Analysis
  if (report.aiFocusOrderAnalysis) {
    lines.push("### Focus Order Analysis");
    lines.push("");
    const analysis = report.aiFocusOrderAnalysis;
    if (typeof analysis === "string") {
      lines.push(analysis);
    } else {
      const a = analysis as AIFocusOrderResult;
      lines.push(`**Assessment:** ${a.overallAssessment}`);
      lines.push("");
      lines.push(a.summary);
      if (a.issues.length > 0) {
        lines.push("");
        lines.push("| # | Severity | Description | Suggestion |");
        lines.push("| --- | --- | --- | --- |");
        for (const issue of a.issues) {
          lines.push(
            `| ${issue.elementIndex} | ${issue.severity} | ${esc(issue.description)} | ${esc(issue.suggestion)} |`,
          );
        }
      }
    }
    lines.push("");
  }

  // Widget Classifications
  if (report.widgetClassifications && report.widgetClassifications.length > 0) {
    lines.push("### Widget Classifications");
    lines.push("");
    lines.push("| Element | Pattern | Confidence | Expected Keyboard |");
    lines.push("| --- | --- | --- | --- |");
    for (const w of report.widgetClassifications) {
      const elLabel = esc(
        w.element.accessibleName || w.element.role || w.element.tagName,
      );
      const keys = w.expectedKeyboard
        .map((k) => `\`${k.key}\`: ${k.expectedBehavior}`)
        .join("; ");
      lines.push(
        `| ${elLabel} (\`${esc(truncate(w.element.selector, 40))}\`) | ${w.pattern} | ${(w.confidence * 100).toFixed(0)}% | ${esc(keys)} |`,
      );
    }
    lines.push("");
  }

  // Accessible Name Suggestions
  if (
    report.accessibleNameSuggestions &&
    report.accessibleNameSuggestions.length > 0
  ) {
    lines.push("### Accessible Name Suggestions");
    lines.push("");
    lines.push(
      "| Element | Suggested Label | Suggested Role | Confidence | Reasoning |",
    );
    lines.push("| --- | --- | --- | --- | --- |");
    for (const s of report.accessibleNameSuggestions) {
      const elLabel = esc(s.element.role || s.element.tagName);
      lines.push(
        `| ${elLabel} (\`${esc(truncate(s.element.selector, 40))}\`) | ${esc(s.suggestedLabel)} | ${s.suggestedRole || "-"} | ${(s.confidence * 100).toFixed(0)}% | ${esc(s.reasoning)} |`,
      );
    }
    lines.push("");
  }

  // Focus Indicator Scores
  if (report.focusIndicatorScores && report.focusIndicatorScores.length > 0) {
    lines.push("### Focus Indicator Scores");
    lines.push("");
    lines.push("| Element | Score | Contrast | Visibility | Recommendation |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const f of report.focusIndicatorScores) {
      const elLabel = esc(
        f.element.accessibleName || f.element.role || f.element.tagName,
      );
      lines.push(
        `| ${elLabel} (\`${esc(truncate(f.element.selector, 40))}\`) | ${f.score}/10 | ${f.contrast} | ${f.visibility} | ${esc(f.recommendation || "-")} |`,
      );
    }
    lines.push("");
  }

  // AI Summary
  if (report.aiSummary) {
    lines.push("### AI Summary");
    lines.push("");
    renderAISummary(lines, report.aiSummary);
    lines.push("");
  }

  return lines.join("\n");
}

function renderAISummary(
  lines: string[],
  summary: string | AIReportSummary,
): void {
  if (typeof summary === "string") {
    lines.push(summary);
    return;
  }

  const s = summary as AIReportSummary;
  lines.push(s.overview);
  lines.push("");

  if (s.criticalIssues.length > 0) {
    lines.push("**Critical Issues:**");
    for (const issue of s.criticalIssues) {
      lines.push(`- ${esc(issue)}`);
    }
    lines.push("");
  }

  if (s.prioritizedFixes.length > 0) {
    lines.push("**Prioritized Fixes:**");
    lines.push("");
    lines.push("| Fix | Effort | Impact |");
    lines.push("| --- | --- | --- |");
    for (const f of s.prioritizedFixes) {
      lines.push(`| ${esc(f.fix)} | ${f.effort} | ${f.impact} |`);
    }
    lines.push("");
  }

  lines.push(`**AI Severity Rating:** ${s.aiSeverityRating}/100`);
  lines.push("");
  lines.push(`**Recommendation:** ${esc(s.recommendation)}`);
}

function renderFooter(version: string, timestamp: string): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`Generated by Keylens v${version} on ${timestamp}`);
  lines.push("");
  return lines.join("\n");
}

// ─── Build single-page markdown ──────────────────────────────────

export function renderMarkdown(report: AuditReport): string {
  const sections: string[] = [];
  sections.push(renderHeader(report));
  sections.push(renderSummary(report));
  sections.push(renderCrawl(report));
  sections.push(renderFocusSequence(report));
  sections.push(renderSkipLink(report));
  sections.push(renderRules(report));
  sections.push(renderAIAnalysis(report));
  sections.push(renderFooter(report.version, report.timestamp));
  return sections.filter(Boolean).join("\n");
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Output audit results as a Markdown file.
 */
export async function reportMarkdown(
  report: AuditReport,
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  await writeReportFile(
    outputDir,
    "keylens-report.md",
    renderMarkdown(report),
    "Markdown",
    signal,
    report.url,
  );
}
