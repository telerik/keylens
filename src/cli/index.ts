import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { audit, renderAuditReport } from "../index.js";
import {
  printSavedReports,
  reportCLISummary,
} from "../reporters/cli-reporter.js";
import {
  loadConfigInput,
  DEFAULT_CONFIG,
  normalizeConfig,
} from "../utils/config.js";
import { ConfigError } from "../errors.js";
import { createExecutionScope } from "../utils/execution.js";
import { setLogLevel } from "../utils/logger.js";
import {
  markWelcomeSeen,
  renderCompactBanner,
  renderAuditBanner,
  renderWelcome,
  type BannerEnvironment,
} from "./banner.js";
import { AUDIT_HELP_FOOTER, HELP_STYLE, PROGRAM_HELP_FOOTER } from "./help.js";
import type {
  KeylensConfig,
  KeylensConfigInput,
  AuditEvent,
  LogLevel,
  PageCaptureMode,
  ReporterType,
  PrepareConsentPreference,
} from "../types/index.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

function bannerEnvironment(): BannerEnvironment {
  return {
    isTTY: Boolean(process.stdout.isTTY),
    columns: process.stdout.columns,
    env: process.env,
  };
}

function parseViewport(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    throw new ConfigError(
      `Invalid viewport "${value}". Expected WIDTHxHEIGHT, for example 1280x720.`,
    );
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function updateProgress(
  spinner: ReturnType<typeof ora>,
  event: AuditEvent,
): void {
  const page = event.url ? ` ${event.url}` : "";
  if (event.type === "crawl-progress") {
    spinner.text = `Tabbing${page}: ${event.tabsAttempted}/${event.maxTabs} attempts, ${event.elementsFocused} focused`;
  } else if (event.type === "interaction-progress") {
    spinner.text = `Testing interactions${page}: ${event.completed}/${event.maxCases} completed`;
  } else if (event.type === "rule-started") {
    spinner.text = `Checking ${event.ruleId}${page}`;
  } else if (event.type === "interaction-completed") {
    spinner.text = `Interactions${page}: ${event.completed}/${event.attempted} completed`;
  } else if (event.type === "overlay-dismissed") {
    spinner.text = `Dismissed ${event.provider} consent banner (${event.action})${page}`;
  } else if (event.type === "phase-started") {
    spinner.text =
      event.phase === "interactions"
        ? `Testing interactions${page}: 0 completed`
        : `${event.phase[0].toUpperCase()}${event.phase.slice(1)}${page}`;
  }
}

const program = new Command();

program
  .name("keylens")
  .description(
    "Keyboard navigation testing CLI. Audits your website for keyboard accessibility issues.",
  )
  .version(VERSION)
  .configureHelp(HELP_STYLE)
  .addHelpText("beforeAll", () => renderCompactBanner(VERSION))
  .addHelpText("after", PROGRAM_HELP_FOOTER);

program
  .command("audit")
  .alias("scan")
  .description("Run a keyboard navigation audit on a URL")
  .argument("[url]", "URL to audit (reads from config if omitted)")
  .addHelpText("after", AUDIT_HELP_FOOTER)
  .optionsGroup("Setup:")
  .option("-c, --config <path>", "path to keylens.config.json")
  .option("--profile <profile>", "execution profile (fast, balanced, thorough)")
  .optionsGroup("Reports:")
  .option(
    "-o, --output <reporters>",
    "reporters to use (comma-separated: cli,json,html,markdown)",
  )
  .option("-d, --output-dir <dir>", "output directory for reports")
  .option(
    "--output-name <name>",
    "base file name for report files (default: keylens-report)",
  )
  .option(
    "--no-timestamp",
    "do not append a timestamp to report file names (they will be overwritten on each run)",
  )
  .option(
    "--page-screenshot <mode>",
    "page screenshot mode (none, viewport, full); defaults to full for HTML reports",
  )
  .optionsGroup("Browser & page load:")
  .option(
    "-b, --browser <browser>",
    "browser engine (chromium, firefox, webkit)",
  )
  .option("--headed", "run in headed mode (visible browser)", false)
  .option("--viewport <WxH>", "viewport dimensions (e.g., 1280x720)")
  .option("--timeout <ms>", "navigation timeout in ms")
  .option("--wait-for <selector>", "wait for this CSS selector before auditing")
  .option("--wait <ms>", "wait this many ms after page load")
  .optionsGroup("Crawl:")
  .option("--max-tabs <n>", "maximum tab presses")
  .option("--tab-delay <ms>", "delay between tab presses in ms (min: 10)")
  .option(
    "--interactions",
    "enable experimental bounded activation and focus checks",
    false,
  )
  .optionsGroup("Overlays & page preparation:")
  .option(
    "--keep-overlays",
    "skip automatic cookie/consent banner dismissal before auditing",
    false,
  )
  .option(
    "--no-expand-scroll-containers",
    "skip neutralizing full-page 'faux scroll' containers (parallax/smooth-scroll designs) before auditing",
  )
  .option(
    "--dismiss <selector>",
    "extra CSS selector to click before auditing (repeatable)",
    (value: string, previous: string[]) => [...previous, value],
    [] as string[],
  )
  .option(
    "--consent <preference>",
    "preferred consent action: reject, accept, or close",
  )
  .optionsGroup("Logging:")
  .option("-q, --quiet", "suppress non-essential output", false)
  .option("-v, --verbose", "enable verbose/debug output", false)
  .action(async (url: string | undefined, options) => {
    console.log(
      options.quiet
        ? renderCompactBanner(VERSION)
        : renderAuditBanner(VERSION, bannerEnvironment()),
    );
    let spinner: ReturnType<typeof ora> | undefined;
    let totalScope: ReturnType<typeof createExecutionScope> | undefined;
    const interrupt = new AbortController();
    const onInterrupt = () => {
      if (interrupt.signal.aborted) process.exit(130);
      spinner?.stop();
      console.error(
        chalk.yellow("\nCancelling audit… press Ctrl+C again to force quit."),
      );
      interrupt.abort();
    };
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onInterrupt);

    try {
      // Set log level
      if (options.quiet) setLogLevel("warn");
      if (options.verbose) setLogLevel("debug");
      const logLevel: LogLevel = options.verbose
        ? "debug"
        : options.quiet
          ? "warn"
          : "info";

      // Load config file before resolving options with capability-based defaults.
      let fileConfig: KeylensConfigInput = {};
      if (options.config) {
        fileConfig = await loadConfigInput(options.config);
      }

      const viewport = options.viewport
        ? parseViewport(options.viewport)
        : fileConfig.viewport;

      const reporters = options.output
        ? (options.output.split(",") as ReporterType[])
        : [...(fileConfig.reporters ?? DEFAULT_CONFIG.reporters)];
      // Without an explicit reporter choice the terminal shows the summary;
      // the full issue list and fixes need an explicit `cli` reporter.
      const fullCliReport =
        reporters.includes("cli") &&
        Boolean(options.output ?? fileConfig.reporters);

      const targetUrl = url ?? fileConfig.url;

      if (!targetUrl) {
        throw new ConfigError(
          "No URL provided. Pass a URL argument or set url in config file.",
        );
      }

      const pageCapture =
        options.pageScreenshot ??
        fileConfig.capture?.page ??
        (reporters.includes("html") ? "full" : "none");

      const CONSENT_PREFERENCES: PrepareConsentPreference[] = [
        "reject",
        "accept",
        "close",
      ];
      if (
        options.consent &&
        !CONSENT_PREFERENCES.includes(
          options.consent as PrepareConsentPreference,
        )
      ) {
        throw new ConfigError(
          `Invalid --consent "${options.consent}". Expected one of: ${CONSENT_PREFERENCES.join(", ")}.`,
        );
      }

      const config: KeylensConfig = normalizeConfig({
        ...fileConfig,
        ...(options.profile ? { profile: options.profile } : {}),
        url: targetUrl,
        ...(viewport ? { viewport } : {}),
        rules: {
          ...fileConfig.rules,
        },
        reporters,
        ...(options.outputDir ? { outputDir: options.outputDir } : {}),
        ...(options.outputName ? { outputFileName: options.outputName } : {}),
        ...(options.timestamp === false ? { appendTimestamp: false } : {}),
        ...(options.browser ? { browser: options.browser } : {}),
        headed: options.headed || fileConfig.headed || false,
        waitForSelector: options.waitFor || fileConfig.waitForSelector,
        ...(options.wait ? { waitAfterLoad: Number(options.wait) } : {}),
        ...(options.maxTabs ? { maxTabs: Number(options.maxTabs) } : {}),
        ...(options.tabDelay ? { tabDelay: Number(options.tabDelay) } : {}),
        capture: {
          ...fileConfig.capture,
          page: pageCapture as PageCaptureMode,
          limits: {
            ...fileConfig.capture?.limits,
          },
        },
        interactions: {
          ...fileConfig.interactions,
          enabled:
            options.interactions || fileConfig.interactions?.enabled || false,
          actions: [
            ...(fileConfig.interactions?.actions ??
              DEFAULT_CONFIG.interactions.actions),
          ],
        },
        timeouts: {
          ...fileConfig.timeouts,
        },
        prepare: {
          ...fileConfig.prepare,
          ...(options.keepOverlays ? { dismissOverlays: false } : {}),
          ...(options.expandScrollContainers === false
            ? { expandScrollContainers: false }
            : {}),
          ...(options.consent
            ? {
                consentPreference: options.consent as PrepareConsentPreference,
              }
            : {}),
          dismissSelectors: [
            ...(fileConfig.prepare?.dismissSelectors ?? []),
            ...((options.dismiss as string[] | undefined) ?? []),
          ],
        },
        ...(options.timeout
          ? { navigationTimeout: Number(options.timeout) }
          : {}),
      });

      spinner = ora({
        text: "Starting audit...",
        isSilent: options.quiet,
      }).start();
      const activeSpinner = spinner;
      totalScope = createExecutionScope({
        parentSignal: interrupt.signal,
        timeout: config.timeouts.total,
        phase: "setup",
        timeoutKind: "total",
      });
      const onEvent = (event: AuditEvent) => {
        updateProgress(activeSpinner, event);
      };

      // Progress is shown by the spinner; per-step logs only with --verbose.
      const report = await audit(targetUrl, {
        ...config,
        logLevel: options.verbose ? "debug" : "warn",
        signal: totalScope.signal,
        onEvent,
        telemetrySurface: "cli",
      });
      spinner.stop();
      const summaryOnly = config.reporters.includes("cli") && !fullCliReport;
      if (summaryOnly || (!options.quiet && !fullCliReport)) {
        reportCLISummary(report, { hintFullReport: summaryOnly });
      }
      const written = await renderAuditReport(
        report,
        summaryOnly
          ? config.reporters.filter((r) => r !== "cli")
          : config.reporters,
        config.outputDir,
        { logLevel, signal: totalScope.signal },
      );
      if (!options.quiet) printSavedReports(written);

      if (report.summary.errors > 0) {
        process.exitCode = 2;
      } else if (report.summary.totalErrors > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      if (interrupt.signal.aborted) {
        spinner?.stop();
        console.error(chalk.yellow("Audit cancelled."));
        process.exitCode = 130;
        return;
      }
      spinner?.fail(chalk.red(`Audit failed: ${(error as Error).message}`));
      if (!spinner) {
        console.error(chalk.red(`Audit failed: ${(error as Error).message}`));
      }
      if (options.verbose) {
        console.error(error);
      }
      process.exitCode = 2;
    } finally {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onInterrupt);
      totalScope?.dispose();
    }
  });

program
  .command("init")
  .description("Create a keylens.config.json in the current directory")
  .action(async () => {
    const { writeFile, access } = await import("fs/promises");

    // Warn if config already exists
    try {
      await access("keylens.config.json");
      console.warn(
        chalk.yellow("⚠"),
        "keylens.config.json already exists. Overwriting.",
      );
    } catch {
      // File doesn't exist — proceed
    }

    const config = {
      $schema:
        "https://raw.githubusercontent.com/telerik/keylens/develop/keylens.config.schema.json",
      profile: "balanced",
      url: "https://example.com",
      viewport: { width: 1280, height: 720 },
      tabDelay: 250,
      rules: DEFAULT_CONFIG.rules,
      reporters: ["cli", "json"],
      outputDir: "./keylens-report",
      browser: "chromium",
    };

    await writeFile(
      "keylens.config.json",
      JSON.stringify(config, null, 2) + "\n",
      "utf-8",
    );

    console.log(chalk.green("✓"), "Created keylens.config.json");
    console.log(chalk.gray("  Edit the file, then run: keylens audit <url>"));
  });

// Bare `keylens` shows a welcome screen with quick-start hints instead of help.
const args = process.argv.slice(2);
if (args.length === 0) {
  const environment = bannerEnvironment();
  console.log(renderWelcome(VERSION, environment));
  if (environment.isTTY) markWelcomeSeen();
}

// Allow `keylens <url>` as shorthand for `keylens audit <url>`
const firstArg = args[0];
if (
  firstArg !== undefined &&
  !program.commands.some(
    (cmd) => cmd.name() === firstArg || cmd.aliases().includes(firstArg),
  ) &&
  !firstArg.startsWith("-") &&
  /^https?:\/\//.test(firstArg)
) {
  process.argv.splice(2, 0, "audit");
}

if (args.length > 0) {
  try {
    await program.parseAsync();
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exitCode = 2;
  }
}
