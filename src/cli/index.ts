import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import {
  audit,
  auditMultiple,
  renderAuditReport,
  renderMultiPageReport,
} from "../index.js";
import {
  loadConfigInput,
  DEFAULT_CONFIG,
  normalizeConfig,
} from "../utils/config.js";
import { ConfigError } from "../errors.js";
import { createExecutionScope } from "../utils/execution.js";
import { setLogLevel } from "../utils/logger.js";
import type {
  KeylensConfig,
  KeylensConfigInput,
  AuditEvent,
  LogLevel,
  PageCaptureMode,
  ReporterType,
} from "../types/index.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

const BANNER = `
${chalk.cyan.bold("Keylens")} ${chalk.gray(`v${VERSION}`)}
${chalk.gray("See your site through the lens of keyboard users.")}
`;

function parseViewport(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    throw new ConfigError(
      `Invalid viewport "${value}". Expected WIDTHxHEIGHT, for example 1280x720.`,
    );
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

interface CLIProgressState {
  captureElements: boolean;
  focusedCaptures: number;
  unfocusedCaptures: number;
  captureBytes: number;
}

function formatProgressBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateProgress(
  spinner: ReturnType<typeof ora>,
  event: AuditEvent,
  state: CLIProgressState,
): void {
  const page = event.url ? ` ${event.url}` : "";
  if (event.type === "crawl-progress") {
    const capture = state.captureElements
      ? `, ${Math.min(state.focusedCaptures, state.unfocusedCaptures)} focus pairs, ${formatProgressBytes(state.captureBytes)}`
      : "";
    spinner.text = `Tabbing${state.captureElements ? " and capturing focus states" : ""}${page}: ${event.tabsAttempted}/${event.maxTabs} attempts, ${event.elementsFocused} focused${capture}`;
  } else if (event.type === "asset-captured") {
    if (event.assetType === "focused-element-screenshot") {
      state.focusedCaptures++;
      state.captureBytes += event.byteLength;
    } else if (event.assetType === "unfocused-element-screenshot") {
      state.unfocusedCaptures++;
      state.captureBytes += event.byteLength;
    }
    if (
      event.assetType === "focused-element-screenshot" ||
      event.assetType === "unfocused-element-screenshot"
    ) {
      spinner.text = `Capturing focus states${page}: ${Math.min(state.focusedCaptures, state.unfocusedCaptures)} pairs, ${formatProgressBytes(state.captureBytes)}`;
    }
  } else if (event.type === "interaction-progress") {
    spinner.text = `Testing interactions${page}: ${event.completed}/${event.maxCases} completed`;
  } else if (event.type === "rule-started") {
    spinner.text = `Checking ${event.ruleId}${page}`;
  } else if (event.type === "interaction-completed") {
    spinner.text = `Interactions${page}: ${event.completed}/${event.attempted} completed`;
  } else if (event.type === "phase-started") {
    spinner.text =
      event.phase === "interactions"
        ? `Testing interactions${page}: 0 completed`
        : `${event.phase[0]!.toUpperCase()}${event.phase.slice(1)}${page}`;
  }
}

const program = new Command();

program
  .name("keylens")
  .description(
    "Keyboard navigation testing CLI. Audits your website for keyboard accessibility issues.",
  )
  .version(VERSION);

program
  .command("audit")
  .alias("scan")
  .description("Run a keyboard navigation audit on one or more URLs")
  .argument("[url]", "URL to audit (reads from config if omitted)")
  .option("-c, --config <path>", "path to keylens.config.json")
  .option("--profile <profile>", "execution profile (fast, balanced, thorough)")
  .option(
    "-o, --output <reporters>",
    "reporters to use (comma-separated: cli,json,html,markdown)",
  )
  .option("-d, --output-dir <dir>", "output directory for reports")
  .option(
    "-b, --browser <browser>",
    "browser engine (chromium, firefox, webkit)",
  )
  .option("--headed", "run in headed mode (visible browser)", false)
  .option("--wait-for <selector>", "wait for this CSS selector before auditing")
  .option("--wait <ms>", "wait this many ms after page load")
  .option("--max-tabs <n>", "maximum tab presses")
  .option("--tab-delay <ms>", "delay between tab presses in ms (min: 10)")
  .option("--viewport <WxH>", "viewport dimensions (e.g., 1280x720)")
  .option("--ai", "enable experimental AI-powered analysis", false)
  .option(
    "--ai-model <model>",
    "AI model to use (default: claude-sonnet-4-20250514)",
  )
  .option("--ai-provider <provider>", "AI provider (anthropic, openai)")
  .option(
    "--ai-base-url <url>",
    "AI provider base URL (for Azure AI Foundry, custom endpoints)",
  )
  .option("--timeout <ms>", "navigation timeout in ms")
  .option(
    "--page-screenshot <mode>",
    "page screenshot mode (none, viewport, full); defaults to full for HTML reports",
  )
  .option(
    "--screenshots",
    "capture per-element screenshots for focus indicator diffing",
    false,
  )
  .option(
    "--interactions",
    "enable experimental bounded activation and focus checks",
    false,
  )
  .option("-q, --quiet", "suppress non-essential output", false)
  .option("-v, --verbose", "enable verbose/debug output", false)
  .action(async (url: string | undefined, options) => {
    console.log(BANNER);
    let spinner: ReturnType<typeof ora> | undefined;
    let totalScope: ReturnType<typeof createExecutionScope> | undefined;

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

      const urls: string[] = url
        ? [url]
        : fileConfig.urls && fileConfig.urls.length > 0
          ? fileConfig.urls
          : [];

      if (urls.length === 0) {
        throw new ConfigError(
          "No URL provided. Pass a URL argument or set urls in config file.",
        );
      }

      const pageCapture =
        options.pageScreenshot ??
        fileConfig.capture?.page ??
        (reporters.includes("html") ? "full" : "none");
      const captureElements =
        options.screenshots || (fileConfig.capture?.elements ?? false);
      const config: KeylensConfig = normalizeConfig({
        ...fileConfig,
        ...(options.profile ? { profile: options.profile } : {}),
        urls,
        ...(viewport ? { viewport } : {}),
        rules: {
          ...fileConfig.rules,
        },
        reporters,
        ...(options.outputDir ? { outputDir: options.outputDir } : {}),
        ...(options.browser ? { browser: options.browser } : {}),
        headed: options.headed || fileConfig.headed || false,
        waitForSelector: options.waitFor || fileConfig.waitForSelector,
        ...(options.wait ? { waitAfterLoad: Number(options.wait) } : {}),
        ...(options.maxTabs ? { maxTabs: Number(options.maxTabs) } : {}),
        ...(options.tabDelay ? { tabDelay: Number(options.tabDelay) } : {}),
        capture: {
          ...fileConfig.capture,
          page: pageCapture as PageCaptureMode,
          elements: captureElements,
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
        multiPage: {
          ...fileConfig.multiPage,
        },
        timeouts: {
          ...fileConfig.timeouts,
        },
        ...(options.timeout
          ? { navigationTimeout: Number(options.timeout) }
          : {}),
        ai: {
          ...fileConfig.ai,
          enabled: options.ai || fileConfig.ai?.enabled || false,
          apiKey: fileConfig.ai?.apiKey,
          model: options.aiModel || fileConfig.ai?.model,
          provider:
            options.aiProvider ||
            fileConfig.ai?.provider ||
            DEFAULT_CONFIG.ai.provider,
          baseURL: options.aiBaseUrl || fileConfig.ai?.baseURL,
          features: {
            ...fileConfig.ai?.features,
          },
          limits: {
            ...fileConfig.ai?.limits,
          },
        },
      });

      spinner = ora({
        text: "Starting audit...",
        isSilent: options.quiet,
      }).start();
      totalScope = createExecutionScope({
        timeout: config.timeouts.total,
        phase: "setup",
        timeoutKind: "total",
      });
      const progressStates = new Map<string, CLIProgressState>();
      const onEvent = (event: AuditEvent) => {
        const key = event.url ?? "";
        let state = progressStates.get(key);
        if (!state) {
          state = {
            captureElements: config.capture.elements,
            focusedCaptures: 0,
            unfocusedCaptures: 0,
            captureBytes: 0,
          };
          progressStates.set(key, state);
        }
        updateProgress(spinner!, event, state);
      };

      if (urls.length === 1) {
        const report = await audit(urls[0]!, {
          ...config,
          logLevel,
          signal: totalScope.signal,
          onEvent,
        });
        spinner.stop();
        await renderAuditReport(report, config.reporters, config.outputDir, {
          logLevel,
          signal: totalScope.signal,
        });

        if (report.summary.errors > 0) {
          process.exitCode = 2;
        } else if (report.summary.totalErrors > 0) {
          process.exitCode = 1;
        }
      } else {
        // Multi-page audit
        const multiReport = await auditMultiple(urls, {
          ...config,
          logLevel,
          signal: totalScope.signal,
          onEvent,
        });
        spinner.stop();
        await renderMultiPageReport(
          multiReport,
          config.reporters,
          config.outputDir,
          { logLevel, signal: totalScope.signal },
        );

        if (multiReport.summary.ruleErrors > 0) {
          process.exitCode = 2;
        } else if (multiReport.summary.totalErrors > 0) {
          process.exitCode = 1;
        }
      }
    } catch (error) {
      spinner?.fail(chalk.red(`Audit failed: ${(error as Error).message}`));
      if (!spinner) {
        console.error(chalk.red(`Audit failed: ${(error as Error).message}`));
      }
      if (options.verbose) {
        console.error(error);
      }
      process.exitCode = 2;
    } finally {
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
        "https://raw.githubusercontent.com/telerik/keylens/master/keylens.config.schema.json",
      profile: "balanced",
      urls: ["https://example.com"],
      viewport: { width: 1280, height: 720 },
      tabDelay: 250,
      rules: DEFAULT_CONFIG.rules,
      reporters: ["cli", "json"],
      outputDir: "./keylens-report",
      browser: "chromium",
      ai: {
        enabled: false,
        provider: "anthropic",
        features: DEFAULT_CONFIG.ai.features,
      },
    };

    await writeFile(
      "keylens.config.json",
      JSON.stringify(config, null, 2) + "\n",
      "utf-8",
    );

    console.log(chalk.green("✓"), "Created keylens.config.json");
    console.log(chalk.gray("  Edit the file, then run: keylens audit <url>"));
  });

program
  .command("mcp")
  .description("Start the experimental Keylens MCP server (stdio transport)")
  .action(async () => {
    await import("../mcp/server.js");
  });

// Allow `keylens <url>` as shorthand for `keylens audit <url>`
const args = process.argv.slice(2);
if (
  args.length > 0 &&
  !program.commands.some(
    (cmd) => cmd.name() === args[0] || cmd.aliases().includes(args[0]!),
  ) &&
  !args[0]!.startsWith("-") &&
  /^https?:\/\//.test(args[0]!)
) {
  process.argv.splice(2, 0, "audit");
}

try {
  await program.parseAsync();
} catch (error) {
  console.error(chalk.red((error as Error).message));
  process.exitCode = 2;
}
