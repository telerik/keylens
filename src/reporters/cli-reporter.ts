import chalk from "chalk";
import type {
  AuditReport,
  AIFocusOrderResult,
  FixSuggestion,
  AIReportSummary,
} from "../types/index.js";
import { logger } from "../utils/logger.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  if (crawl.prepare?.dismissals.length) {
    const dismissed = crawl.prepare.dismissals
      .map(
        (d) => `${d.provider} (${d.action}${d.verified ? "" : ", unverified"})`,
      )
      .join(", ");
    console.log(chalk.bold("Overlays dismissed:"), dismissed);
  }
  if (crawl.prepare?.scrollContainerExpanded) {
    const { selector, originalHeight, expandedHeight } =
      crawl.prepare.scrollContainerExpanded;
    console.log(
      chalk.bold("Scroll container expanded:"),
      `${selector} (${originalHeight}px -> ${expandedHeight}px)`,
    );
  }
  if (crawl.prepare?.warnings.length) {
    console.log(
      chalk.bold("Prepare warnings:"),
      chalk.yellow(crawl.prepare.warnings.join("; ")),
    );
  }
  if (report.config.capture.elements) {
    const focusSequence = report.focusSequence ?? [];
    const pairs = focusSequence.filter(
      (element) =>
        element.focusedScreenshotAssetId && element.unfocusedScreenshotAssetId,
    ).length;
    const partialPairs = focusSequence.filter(
      (element) =>
        Boolean(element.focusedScreenshotAssetId) !==
        Boolean(element.unfocusedScreenshotAssetId),
    ).length;
    const focusAssetIds = new Set(
      focusSequence.flatMap((element) =>
        [
          element.focusedScreenshotAssetId,
          element.unfocusedScreenshotAssetId,
        ].filter((id): id is string => Boolean(id)),
      ),
    );
    const focusAssets =
      report.assets?.filter((asset) => focusAssetIds.has(asset.id)) ?? [];
    const focusBytes = focusAssets.reduce(
      (total, asset) => total + asset.byteLength,
      0,
    );
    const coverage = [
      `${pairs} complete pair(s)`,
      `${formatBytes(focusBytes)}`,
    ];
    if (partialPairs > 0) {
      coverage.push(`${partialPairs} partial pair(s)`);
    }
    console.log(chalk.bold("Focus screenshots:"), coverage.join(", "));
    if (crawl.capture.skipped > 0 || crawl.capture.failed > 0) {
      console.log(
        chalk.bold("Capture omissions:"),
        `${crawl.capture.skipped} skipped, ${crawl.capture.failed} failed across page and focus captures`,
      );
    }
  }

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
      if (rule.ruleId === "focus-after-interaction") {
        const interactionErrors =
          report.interactionResults?.filter(
            (result) => result.status === "error",
          ) ?? [];
        for (const result of interactionErrors.slice(0, 5)) {
          console.error(
            chalk.gray(
              `  └─ ${result.element.selector} [${result.reason}]: ${result.message ?? "unknown error"}`,
            ),
          );
        }
        if (interactionErrors.length > 5) {
          console.error(
            chalk.gray(`  └─ ... and ${interactionErrors.length - 5} more`),
          );
        }
      }
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
