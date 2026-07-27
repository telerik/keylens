import chalk from "chalk";
import type {
  AuditReport,
  MultiPageReport,
  AIFocusOrderResult,
  FixSuggestion,
  AIReportSummary,
} from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * Output audit results to the terminal with colored formatting.
 */
export function reportCLI(report: AuditReport): void {
  const { summary, rules, crawl, url } = report;

  logger.blank();
  console.log(
    chalk.bold.cyan("🔍 Keylens") +
      chalk.gray(` v${report.version}`) +
      chalk.gray(" — Keyboard Navigation Audit"),
  );
  logger.divider();

  // URL and crawl summary
  console.log(chalk.bold("URL:"), url);
  console.log(chalk.bold("Focusable elements:"), crawl.totalFocusableElements);
  console.log(
    chalk.bold("Interactive elements:"),
    crawl.totalInteractiveElements,
  );
  console.log(
    chalk.bold("Unreached:"),
    crawl.unreachedElements > 0
      ? chalk.red(crawl.unreachedElements.toString())
      : chalk.green("0"),
  );
  console.log(
    chalk.bold("Tab cycle completed:"),
    crawl.cycleCompleted ? chalk.green("Yes") : chalk.yellow("No"),
  );
  console.log(chalk.bold("Duration:"), chalk.gray(`${crawl.duration}ms`));

  logger.blank();
  logger.divider();
  console.log(chalk.bold("Rules:"));
  logger.blank();

  // Rule results
  for (const rule of rules) {
    if (rule.status === "error") {
      logger.error(
        `${rule.ruleId}: rule evaluation error — ${rule.error?.message ?? "unknown error"}`,
      );
    } else if (rule.passed) {
      logger.rule(true, rule.ruleId);
    } else {
      logger.rule(false, rule.ruleId, `${rule.violations.length} issue(s)`);

      for (const violation of rule.violations) {
        const icon =
          violation.severity === "error"
            ? chalk.red("  ●")
            : chalk.yellow("  ●");
        console.log(`${icon} ${chalk.white(violation.message)}`);

        // Show affected elements (up to 5)
        const elementsToShow = violation.elements.slice(0, 5);
        for (const el of elementsToShow) {
          console.log(chalk.gray(`    └─ ${el.selector}`));
        }

        if (violation.elements.length > 5) {
          console.log(
            chalk.gray(`    └─ ... and ${violation.elements.length - 5} more`),
          );
        }

        // Show AI fix suggestion if available
        if (violation.fixSuggestion) {
          if (typeof violation.fixSuggestion === "string") {
            console.log(
              chalk.cyan("    💡 AI Suggestion: ") +
                chalk.white(violation.fixSuggestion),
            );
          } else {
            const fix = violation.fixSuggestion as FixSuggestion;
            const effortColor =
              fix.estimatedEffort === "low"
                ? chalk.green
                : fix.estimatedEffort === "medium"
                  ? chalk.yellow
                  : chalk.red;
            console.log(
              chalk.cyan("    💡 Fix: ") +
                chalk.white(fix.summary) +
                chalk.gray(" [") +
                effortColor(fix.estimatedEffort) +
                chalk.gray(" effort]"),
            );
            if (fix.codeBefore && fix.codeAfter) {
              console.log(chalk.red("      - ") + chalk.gray(fix.codeBefore));
              console.log(chalk.green("      + ") + chalk.gray(fix.codeAfter));
            }
            console.log(chalk.gray(`      ${fix.explanation}`));
          }
        }
      }
    }
  }

  // Summary
  logger.blank();
  logger.divider();

  const resultLine =
    summary.errors > 0
      ? chalk.red.bold(
          `Audit incomplete: ${summary.errors} rule evaluation error(s)`,
        )
      : summary.totalErrors > 0
        ? chalk.red.bold(
            `${summary.totalErrors} error(s), ${summary.totalWarnings} warning(s)`,
          )
        : summary.totalWarnings > 0
          ? chalk.yellow.bold(`${summary.totalWarnings} warning(s)`)
          : chalk.green.bold("All checks passed!");

  // Deterministic score
  const scoreColor =
    summary.score >= 70
      ? chalk.green
      : summary.score >= 50
        ? chalk.yellow
        : chalk.red;
  console.log(
    chalk.bold("Result:"),
    resultLine,
    chalk.gray(" — Score: ") +
      scoreColor(
        `${summary.score}/100${summary.scoreComplete === false ? " (incomplete)" : ""}`,
      ),
  );

  // Widget classifications if available
  if (report.widgetClassifications && report.widgetClassifications.length > 0) {
    logger.blank();
    logger.divider();
    console.log(chalk.bold("Widget Classifications:"));
    logger.blank();

    for (const wc of report.widgetClassifications) {
      const conf = Math.round(wc.confidence * 100);
      console.log(
        chalk.cyan(`  ${wc.pattern}`) +
          chalk.gray(` (${conf}% confidence)`) +
          chalk.white(` — ${wc.element.accessibleName || wc.element.selector}`),
      );
      for (const kb of wc.expectedKeyboard) {
        console.log(chalk.gray(`    ${kb.key}: ${kb.expectedBehavior}`));
      }
    }
  }

  // AI focus order analysis if available
  if (report.aiFocusOrderAnalysis) {
    logger.blank();
    logger.divider();
    if (typeof report.aiFocusOrderAnalysis === "string") {
      console.log(chalk.bold("AI Focus Order Analysis:"));
      console.log(chalk.white(report.aiFocusOrderAnalysis));
    } else {
      const analysis = report.aiFocusOrderAnalysis as AIFocusOrderResult;
      const assessColor =
        analysis.overallAssessment === "good"
          ? chalk.green
          : analysis.overallAssessment === "acceptable"
            ? chalk.yellow
            : chalk.red;
      console.log(
        chalk.bold("AI Focus Order Analysis: ") +
          assessColor(analysis.overallAssessment),
      );
      console.log(chalk.white(analysis.summary));
      for (const issue of analysis.issues) {
        const icon =
          issue.severity === "error"
            ? chalk.red("  ●")
            : issue.severity === "warning"
              ? chalk.yellow("  ●")
              : chalk.blue("  ●");
        console.log(
          `${icon} ${chalk.white(`#${issue.elementIndex}:`)} ${chalk.white(issue.description)}`,
        );
        console.log(chalk.gray(`    → ${issue.suggestion}`));
      }
    }
  }

  // Accessible name suggestions if available
  if (
    report.accessibleNameSuggestions &&
    report.accessibleNameSuggestions.length > 0
  ) {
    logger.blank();
    logger.divider();
    console.log(chalk.bold("Accessible Name Suggestions:"));
    logger.blank();

    for (const suggestion of report.accessibleNameSuggestions) {
      const conf = Math.round(suggestion.confidence * 100);
      console.log(
        chalk.cyan(`  ${suggestion.element.selector}`) +
          chalk.gray(` (${conf}% confidence)`),
      );
      console.log(
        chalk.white(`    Label: `) +
          chalk.green(`"${suggestion.suggestedLabel}"`),
      );
      if (suggestion.suggestedRole) {
        console.log(
          chalk.white(`    Role: `) + chalk.yellow(suggestion.suggestedRole),
        );
      }
      console.log(chalk.gray(`    ${suggestion.reasoning}`));
    }
  }

  // Focus indicator quality scores
  if (report.focusIndicatorScores && report.focusIndicatorScores.length > 0) {
    logger.blank();
    logger.divider();
    console.log(chalk.bold("Focus Indicator Quality:"));
    logger.blank();

    for (const fis of report.focusIndicatorScores) {
      const scoreColor =
        fis.score >= 8
          ? chalk.green
          : fis.score >= 5
            ? chalk.yellow
            : chalk.red;
      console.log(
        chalk.cyan(`  ${fis.element.selector}`) +
          chalk.gray(" — ") +
          scoreColor(`${fis.score}/10`) +
          chalk.gray(
            ` (contrast: ${fis.contrast}, visibility: ${fis.visibility})`,
          ),
      );
      if (fis.recommendation) {
        console.log(chalk.gray(`    ${fis.recommendation}`));
      }
    }
  }

  // AI summary (structured or plain text)
  if (report.aiSummary) {
    logger.blank();
    renderAISummary(report.aiSummary);
  }

  logger.blank();
}

/**
 * Output multi-page audit results to the terminal.
 * Each page gets its own section, with an aggregate summary at the end.
 */
export function reportMultiCLI(report: MultiPageReport): void {
  for (const page of report.pages) {
    reportCLI(page);
  }

  // Aggregate summary
  logger.blank();
  logger.divider();
  console.log(chalk.bold.cyan("Multi-Page Summary"));
  logger.divider();
  console.log(chalk.bold("Pages audited:"), report.summary.totalPages);
  console.log(
    chalk.bold("Pages with errors:"),
    report.summary.pagesWithErrors > 0
      ? chalk.red(report.summary.pagesWithErrors.toString())
      : chalk.green("0"),
  );
  console.log(
    chalk.bold("Rule evaluation errors:"),
    report.summary.ruleErrors > 0
      ? chalk.red(report.summary.ruleErrors.toString())
      : chalk.green("0"),
  );
  console.log(
    chalk.bold("Total errors:"),
    report.summary.totalErrors > 0
      ? chalk.red(report.summary.totalErrors.toString())
      : chalk.green("0"),
  );
  console.log(
    chalk.bold("Total warnings:"),
    report.summary.totalWarnings > 0
      ? chalk.yellow(report.summary.totalWarnings.toString())
      : chalk.green("0"),
  );

  const multiScoreColor =
    report.summary.score >= 70
      ? chalk.green
      : report.summary.score >= 50
        ? chalk.yellow
        : chalk.red;
  console.log(
    chalk.bold("Average score:"),
    multiScoreColor(
      `${report.summary.score}/100${report.summary.scoreComplete === false ? " (incomplete)" : ""}`,
    ),
  );

  // Cross-page patterns
  if (report.crossPagePatterns && report.crossPagePatterns.length > 0) {
    logger.blank();
    logger.divider();
    console.log(chalk.bold("Cross-Page Patterns:"));
    logger.blank();

    for (const cp of report.crossPagePatterns) {
      const sevIcon =
        cp.severity === "error"
          ? chalk.red("  ●")
          : cp.severity === "warning"
            ? chalk.yellow("  ●")
            : chalk.blue("  ●");
      console.log(
        `${sevIcon} ${chalk.white(`[${cp.type}]`)} ${chalk.white(cp.description)}`,
      );
      console.log(
        chalk.gray(
          `    Pages: ${cp.affectedPages.map((u) => new URL(u).pathname).join(", ")}`,
        ),
      );
      console.log(chalk.cyan(`    ${cp.suggestion}`));
    }
  }

  // Multi-page AI summary
  if (report.aiSummary) {
    logger.blank();
    renderAISummary(report.aiSummary);
  }

  logger.blank();
}

/**
 * Render an AI summary (structured or plain text) to the terminal.
 */
function renderAISummary(aiSummary: string | AIReportSummary): void {
  if (typeof aiSummary === "string") {
    console.log(chalk.cyan.bold("AI Summary:"));
    console.log(chalk.white(aiSummary));
    return;
  }

  const summary = aiSummary;
  const scoreColor =
    summary.aiSeverityRating >= 70
      ? chalk.green
      : summary.aiSeverityRating >= 50
        ? chalk.yellow
        : chalk.red;
  console.log(
    chalk.cyan.bold("AI Summary") +
      chalk.gray(" — AI Usability Rating: ") +
      scoreColor(`${summary.aiSeverityRating}/100`),
  );
  console.log(chalk.white(summary.overview));

  if (summary.criticalIssues.length > 0) {
    console.log(chalk.red.bold("\n  Critical Issues:"));
    for (const issue of summary.criticalIssues) {
      console.log(chalk.red(`    - ${issue}`));
    }
  }

  if (summary.prioritizedFixes.length > 0) {
    console.log(chalk.bold("\n  Prioritized Fixes:"));
    for (const pf of summary.prioritizedFixes) {
      const effortColor =
        pf.effort === "low"
          ? chalk.green
          : pf.effort === "medium"
            ? chalk.yellow
            : chalk.red;
      const impactColor =
        pf.impact === "high"
          ? chalk.green
          : pf.impact === "medium"
            ? chalk.yellow
            : chalk.red;
      console.log(
        chalk.white(`    - ${pf.fix}`) +
          chalk.gray(" [") +
          effortColor(pf.effort) +
          chalk.gray(" effort, ") +
          impactColor(pf.impact) +
          chalk.gray(" impact]"),
      );
    }
  }

  console.log(chalk.cyan(`\n  Recommendation: ${summary.recommendation}`));
}
