import type { AuditReport } from "../types/index.js";
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
      }
    }

    lines.push("");
  }

  return lines.join("\n");
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
