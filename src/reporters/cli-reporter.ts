import chalk from "chalk";
import { getRuleRemediation } from "../guidance.js";
import { homedir } from "node:os";
import { isAbsolute, relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { AuditReport, RuleResult, WrittenReport } from "../types/index.js";
import { logger } from "../utils/logger.js";

const SCORE_BAR_WIDTH = 24;
const MAX_TOP_FIXES = 3;
const INDENT = "  ";

function scoreColor(score: number): typeof chalk {
  if (score >= 70) return chalk.green;
  if (score >= 50) return chalk.yellow;
  return chalk.red;
}

export function renderScoreBar(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * SCORE_BAR_WIDTH);
  return (
    scoreColor(clamped)("█".repeat(filled)) +
    chalk.gray("░".repeat(SCORE_BAR_WIDTH - filled))
  );
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function countBySeverity(rule: RuleResult): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const violation of rule.violations) {
    if (violation.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings };
}

function wcagLabel(rule: RuleResult): string {
  return rule.wcag?.join(", ") ?? "";
}

function ruleRow(
  rule: RuleResult,
  nameWidth: number,
  wcagWidth: number,
): string {
  const name = rule.ruleId.padEnd(nameWidth);
  const wcag = wcagLabel(rule).padEnd(wcagWidth + 2);
  if (rule.status === "error") {
    return `${INDENT}${chalk.magenta("!")} ${chalk.magenta(name)}  ${chalk.gray(wcag)}${chalk.magenta("evaluator error")}`;
  }
  if (rule.passed) {
    return `${INDENT}${chalk.green("✓")} ${name}  ${chalk.gray(wcag)}${chalk.green("passed")}`;
  }
  const { errors, warnings } = countBySeverity(rule);
  const parts = [
    errors > 0 ? chalk.red(plural(errors, "error")) : "",
    warnings > 0 ? chalk.yellow(plural(warnings, "warning")) : "",
  ].filter(Boolean);
  const icon = errors > 0 ? chalk.red("✗") : chalk.yellow("▲");
  const label = errors > 0 ? chalk.red(name) : chalk.yellow(name);
  return `${INDENT}${icon} ${label}  ${chalk.gray(wcag)}${parts.join(chalk.gray(" · "))}`;
}

function sectionTitle(title: string): void {
  logger.blank();
  console.log(`${INDENT}${chalk.bold.magenta(title)}`);
}

function printHeader(report: AuditReport): void {
  logger.blank();
  console.log(
    `${INDENT}${chalk.bgCyan.black.bold(" KEYLENS ")} ${chalk.bold("Keyboard Navigation Audit")} ${chalk.gray(`v${report.version}`)}`,
  );
  console.log(`${INDENT}${chalk.underline(report.url)}`);
  logger.divider();
}

function printScore(report: AuditReport): void {
  const { summary } = report;
  const incomplete = summary.scoreComplete === false ? " (incomplete)" : "";
  logger.blank();
  console.log(
    `${INDENT}${chalk.bold("Score")}  ${renderScoreBar(summary.score)}  ${scoreColor(summary.score).bold(`${summary.score}/100`)}${chalk.gray(incomplete)}`,
  );
}

function printCrawlStats(report: AuditReport): void {
  const { crawl } = report;
  const separator = chalk.gray("  ·  ");
  const stat = (label: string, value: string) =>
    `${chalk.gray(label)} ${value}`;
  logger.blank();
  console.log(
    INDENT +
      [
        stat(
          "Focusable elements:",
          chalk.bold(String(crawl.totalFocusableElements)),
        ),
        stat(
          "Interactive elements:",
          chalk.bold(String(crawl.totalInteractiveElements)),
        ),
        stat(
          "Unreached:",
          crawl.unreachedElements > 0
            ? chalk.red.bold(String(crawl.unreachedElements))
            : chalk.green.bold("0"),
        ),
      ].join(separator),
  );
  console.log(
    INDENT +
      [
        stat(
          "Tab cycle completed:",
          crawl.cycleCompleted ? chalk.green("Yes") : chalk.yellow("No"),
        ),
        stat("Duration:", formatDuration(crawl.duration)),
      ].join(separator),
  );

  if (crawl.prepare?.dismissals.length) {
    const dismissed = crawl.prepare.dismissals
      .map(
        (d) => `${d.provider} (${d.action}${d.verified ? "" : ", unverified"})`,
      )
      .join(", ");
    console.log(`${INDENT}${chalk.gray("Overlays dismissed:")} ${dismissed}`);
  }
  if (crawl.prepare?.scrollContainerExpanded) {
    const { selector, originalHeight, expandedHeight } =
      crawl.prepare.scrollContainerExpanded;
    console.log(
      `${INDENT}${chalk.gray("Scroll container expanded:")} ${selector} (${originalHeight}px -> ${expandedHeight}px)`,
    );
  }
  if (crawl.prepare?.warnings.length) {
    console.log(
      `${INDENT}${chalk.gray("Prepare warnings:")} ${chalk.yellow(crawl.prepare.warnings.join("; "))}`,
    );
  }
  if ((crawl.capture?.skipped ?? 0) > 0 || (crawl.capture?.failed ?? 0) > 0) {
    console.log(
      `${INDENT}${chalk.gray("Capture omissions:")} ${crawl.capture.skipped} skipped, ${crawl.capture.failed} failed`,
    );
  }
}

function printRuleTable(rules: RuleResult[]): void {
  if (rules.length === 0) return;
  const nameWidth = Math.max(...rules.map((rule) => rule.ruleId.length));
  const wcagWidth = Math.max(...rules.map((rule) => wcagLabel(rule).length));
  sectionTitle("Rules");
  for (const rule of rules) {
    console.log(ruleRow(rule, nameWidth, wcagWidth));
  }
}

function printRuleErrors(report: AuditReport): void {
  for (const rule of report.rules) {
    if (rule.status !== "error") continue;
    logger.error(
      `${rule.ruleId}: rule evaluation error — ${rule.error?.message ?? "unknown error"}`,
    );
    if (rule.ruleId !== "focus-after-interaction") continue;
    const interactionErrors =
      report.interactionResults?.filter(
        (result) => result.status === "error",
      ) ?? [];
    for (const result of interactionErrors) {
      console.error(
        chalk.gray(
          `  └─ ${result.element.selector} [${result.reason}]: ${result.message ?? "unknown error"}`,
        ),
      );
    }
  }
}

/** Prefer the element's markup (what users recognize) over the generated selector. */
function elementLabel(el: { selector: string; outerHTML?: string }): string {
  const html = el.outerHTML?.replace(/\s+/g, " ").trim();
  return html || el.selector;
}

function printIssues(failed: RuleResult[]): void {
  if (failed.length === 0) return;
  sectionTitle("Issues");
  for (const rule of failed) {
    const title = rule.ruleName ? chalk.gray(` ${rule.ruleName}`) : "";
    logger.blank();
    console.log(`${INDENT}${chalk.bold(rule.ruleId)}${title}`);
    for (const violation of rule.violations) {
      const icon =
        violation.severity === "error" ? chalk.red("●") : chalk.yellow("●");
      console.log(`${INDENT}  ${icon} ${violation.message}`);
      for (const el of violation.elements) {
        console.log(chalk.gray(`${INDENT}    └─ ${elementLabel(el)}`));
      }
    }
  }
}

function firstSentence(text: string): string {
  return text.split(/(?<=\.)\s/)[0] ?? text;
}

function printTopFixes(failed: RuleResult[]): void {
  const ranked = failed
    .map((rule) => ({
      rule,
      counts: countBySeverity(rule),
      remediation: getRuleRemediation(rule.ruleId),
    }))
    .filter((entry) => entry.remediation !== undefined)
    .sort(
      (a, b) =>
        b.counts.errors - a.counts.errors ||
        b.counts.warnings - a.counts.warnings,
    )
    .slice(0, MAX_TOP_FIXES);
  if (ranked.length === 0) return;

  sectionTitle("Top fixes");
  ranked.forEach(({ rule, remediation }, index) => {
    console.log(
      `${INDENT}${chalk.cyan(`${index + 1}.`)} ${chalk.bold(remediation!.title)} ${chalk.gray(`(${rule.ruleId})`)}`,
    );
    console.log(`${INDENT}   ${firstSentence(remediation!.guidance)}`);
    const reference = remediation!.wcag[0];
    if (reference) {
      console.log(
        chalk.gray(
          `${INDENT}   WCAG ${reference.id} ${reference.title}: ${reference.url}`,
        ),
      );
    }
  });
}

function printResult(report: AuditReport): void {
  const { summary } = report;
  const resultLine =
    summary.errors > 0
      ? chalk.red.bold(
          `Audit incomplete: ${summary.errors} rule evaluation error(s)`,
        )
      : summary.totalErrors > 0
        ? chalk.red.bold(
            `✗ ${plural(summary.totalErrors, "error")}, ${plural(summary.totalWarnings, "warning")}`,
          )
        : summary.totalWarnings > 0
          ? chalk.yellow.bold(`▲ ${plural(summary.totalWarnings, "warning")}`)
          : chalk.green.bold("✓ All checks passed!");
  const score = `${summary.score}/100${summary.scoreComplete === false ? " (incomplete)" : ""}`;

  logger.blank();
  logger.divider();
  console.log(
    `${INDENT}${chalk.bold("Result:")} ${resultLine}${chalk.gray("  ·  Score: ")}${scoreColor(summary.score)(score)}`,
  );
  logger.blank();
}

/**
 * Compact dashboard (score, crawl stats, rule table, result) for runs whose
 * details go to file reporters instead of the full terminal report.
 */
export function reportCLISummary(
  report: AuditReport,
  options: { hintFullReport?: boolean } = {},
): void {
  printHeader(report);
  printScore(report);
  printCrawlStats(report);
  printRuleTable(report.rules);
  printRuleErrors(report);
  printResult(report);
  const hasFindings = report.rules.some((rule) => !rule.passed);
  if (options.hintFullReport && hasFindings) {
    console.log(
      chalk.gray(
        `${INDENT}Run with ${chalk.cyan("-o cli")} to see every issue and how to fix it.`,
      ),
    );
    logger.blank();
  }
}

/**
 * Output audit results to the terminal as a colored dashboard: score bar,
 * crawl stats, a per-rule table, violation details, and top remediation tips.
 */
export function reportCLI(report: AuditReport): void {
  const failed = report.rules.filter(
    (rule) => rule.status !== "error" && !rule.passed,
  );

  printHeader(report);
  printScore(report);
  printCrawlStats(report);
  printRuleTable(report.rules);
  printRuleErrors(report);
  printIssues(failed);
  printTopFixes(failed);
  printResult(report);
}

const REPORT_LABELS: Record<WrittenReport["type"], string> = {
  html: "HTML",
  json: "JSON",
  markdown: "Markdown",
};

/** Path relative to `cwd` when inside it, otherwise with the home dir as `~`. */
export function shortenPath(
  filePath: string,
  cwd = process.cwd(),
  home = homedir(),
): string {
  const rel = relative(cwd, filePath);
  if (rel && !rel.startsWith("..") && !isAbsolute(rel)) return rel;
  if (home && filePath.startsWith(home))
    return `~${filePath.slice(home.length)}`;
  return filePath;
}

/** Wrap text in an OSC 8 terminal hyperlink. */
export function terminalLink(text: string, url: string): string {
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}

/**
 * List written report files with short paths. In an interactive terminal the
 * paths are clickable `file://` links.
 */
export function printSavedReports(
  reports: WrittenReport[],
  options: { links?: boolean } = {},
): void {
  if (reports.length === 0) return;
  const links =
    options.links ?? (Boolean(process.stdout.isTTY) && !process.env.CI);
  const labelWidth = Math.max(
    ...reports.map((r) => REPORT_LABELS[r.type].length),
  );
  console.log(`${INDENT}${chalk.bold.magenta("Reports saved")}`);
  for (const report of reports) {
    const label = REPORT_LABELS[report.type].padEnd(labelWidth);
    const shortPath = shortenPath(report.path);
    const text = chalk.cyan.underline(shortPath);
    const display = links
      ? terminalLink(text, pathToFileURL(report.path).href)
      : text;
    console.log(
      `${INDENT}${chalk.green("→")} ${chalk.bold(label)}  ${display}`,
    );
  }
  if (links) {
    console.log(chalk.gray(`${INDENT}  Cmd/Ctrl+click a path to open it`));
  }
  logger.blank();
}
