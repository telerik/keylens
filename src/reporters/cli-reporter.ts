import chalk from "chalk";
import type { AuditReport } from "../types/index.js";
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
  if ((crawl.capture?.skipped ?? 0) > 0 || (crawl.capture?.failed ?? 0) > 0) {
    console.log(
      chalk.bold("Capture omissions:"),
      `${crawl.capture.skipped} skipped, ${crawl.capture.failed} failed`,
    );
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

  logger.blank();
}
