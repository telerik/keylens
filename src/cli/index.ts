import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { audit, auditMultiple } from "../index.js";
import { loadConfig, DEFAULT_CONFIG } from "../utils/config.js";
import { setLogLevel } from "../utils/logger.js";
import { runMultiReporters } from "../reporters/index.js";
import type { KeylensConfig, ReporterType } from "../types/index.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

const BANNER = `
${chalk.cyan.bold("Keylens")} ${chalk.gray(`v${VERSION}`)}
${chalk.gray("See your site through the lens of keyboard users.")}
`;

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
  .option(
    "-o, --output <reporters>",
    "reporters to use (comma-separated: cli,json,html,markdown)",
    "cli",
  )
  .option(
    "-d, --output-dir <dir>",
    "output directory for reports",
    "./keylens-report",
  )
  .option(
    "-b, --browser <browser>",
    "browser engine (chromium, firefox, webkit)",
    "chromium",
  )
  .option("--headed", "run in headed mode (visible browser)", false)
  .option("--wait-for <selector>", "wait for this CSS selector before auditing")
  .option("--wait <ms>", "wait this many ms after page load", "1000")
  .option("--max-tabs <n>", "maximum tab presses", "500")
  .option(
    "--tab-delay <ms>",
    "delay between tab presses in ms (min: 10)",
    "250",
  )
  .option(
    "--viewport <WxH>",
    "viewport dimensions (e.g., 1280x720)",
    "1280x720",
  )
  .option("--ai", "enable AI-powered analysis", false)
  .option(
    "--ai-model <model>",
    "AI model to use (default: claude-sonnet-4-20250514)",
  )
  .option("--timeout <ms>", "navigation timeout in ms", "30000")
  .option(
    "--screenshots",
    "capture per-element screenshots for focus indicator diffing",
    false,
  )
  .option("--interactions", "test focus behavior after clicking buttons", false)
  .option("-q, --quiet", "suppress non-essential output", false)
  .option("-v, --verbose", "enable verbose/debug output", false)
  .action(async (url: string | undefined, options) => {
    console.log(BANNER);

    // Set log level
    if (options.quiet) setLogLevel("warn");
    if (options.verbose) setLogLevel("debug");

    // Parse viewport
    const [vw, vh] = options.viewport.split("x").map(Number);
    const viewport = { width: vw || 1280, height: vh || 720 };

    // Validate and parse reporters
    const VALID_REPORTERS = ["cli", "json", "html", "markdown"] as const;
    const reporters = options.output.split(",") as ReporterType[];
    const invalidReporters = reporters.filter(
      (r: string) => !(VALID_REPORTERS as readonly string[]).includes(r),
    );
    if (invalidReporters.length > 0) {
      console.error(
        chalk.red(
          `Invalid reporter(s): ${invalidReporters.join(", ")}. Valid options: ${VALID_REPORTERS.join(", ")}`,
        ),
      );
      process.exit(2);
    }

    // Validate browser
    const VALID_BROWSERS = ["chromium", "firefox", "webkit"] as const;
    if (
      !(VALID_BROWSERS as readonly string[]).includes(options.browser as string)
    ) {
      console.error(
        chalk.red(
          `Invalid browser: ${options.browser}. Valid options: ${VALID_BROWSERS.join(", ")}`,
        ),
      );
      process.exit(2);
    }

    // Load config file if provided
    let fileConfig: Partial<KeylensConfig> = {};
    if (options.config) {
      const loaded = await loadConfig(options.config);
      fileConfig = loaded;
    }

    // Determine URLs to audit
    const urls: string[] = url
      ? [url]
      : fileConfig.urls && fileConfig.urls.length > 0
        ? fileConfig.urls
        : [];

    if (urls.length === 0) {
      console.error(
        chalk.red(
          "No URL provided. Pass a URL argument or set urls in config file.",
        ),
      );
      process.exit(2);
    }

    // Merge CLI options with file config and defaults
    const config: KeylensConfig = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      urls,
      viewport,
      reporters,
      outputDir: options.outputDir,
      browser: options.browser,
      headed: options.headed,
      waitForSelector: options.waitFor || fileConfig.waitForSelector,
      waitAfterLoad: parseInt(options.wait, 10),
      maxTabs: parseInt(options.maxTabs, 10),
      tabDelay: Math.max(10, parseInt(options.tabDelay, 10) || 250),
      captureElementScreenshots:
        options.screenshots || fileConfig.captureElementScreenshots || false,
      interactions: options.interactions || fileConfig.interactions || false,
      navigationTimeout: parseInt(options.timeout, 10) || 30000,
      ai: {
        ...DEFAULT_CONFIG.ai,
        ...fileConfig.ai,
        enabled: options.ai || fileConfig.ai?.enabled || false,
        apiKey: fileConfig.ai?.apiKey,
        model: options.aiModel || fileConfig.ai?.model,
      },
    };

    const spinner = ora("Starting audit...").start();

    try {
      spinner.stop();

      if (urls.length === 1) {
        // Single-page audit (audit() calls reporters internally)
        const report = await audit(urls[0]!, config);

        if (report.summary.totalErrors > 0) {
          process.exit(1);
        }
      } else {
        // Multi-page audit
        const multiReport = await auditMultiple(urls, config);
        await runMultiReporters(
          multiReport,
          config.reporters,
          config.outputDir,
        );

        if (multiReport.summary.totalErrors > 0) {
          process.exit(1);
        }
      }
    } catch (error) {
      spinner.fail(chalk.red(`Audit failed: ${(error as Error).message}`));
      if (options.verbose) {
        console.error(error);
      }
      process.exit(2);
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
  .description("Start the Keylens MCP server (stdio transport)")
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

program.parse();
