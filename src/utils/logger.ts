import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

let currentLevel: LogLevel = "info";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[currentLevel];
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (shouldLog("debug")) {
      console.log(chalk.gray(`  ${message}`), ...args);
    }
  },

  info(message: string, ...args: unknown[]) {
    if (shouldLog("info")) {
      console.log(chalk.blue("ℹ"), message, ...args);
    }
  },

  success(message: string, ...args: unknown[]) {
    if (shouldLog("info")) {
      console.log(chalk.green("✓"), message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]) {
    if (shouldLog("warn")) {
      console.log(chalk.yellow("⚠"), message, ...args);
    }
  },

  error(message: string, ...args: unknown[]) {
    if (shouldLog("error")) {
      console.error(chalk.red("✗"), message, ...args);
    }
  },

  rule(passed: boolean, name: string, detail?: string) {
    const icon = passed ? chalk.green("✓") : chalk.red("✗");
    const label = passed ? chalk.green(name) : chalk.red(name);
    const suffix = detail ? chalk.gray(` — ${detail}`) : "";
    console.log(`  ${icon} ${label}${suffix}`);
  },

  divider() {
    if (shouldLog("info")) {
      console.log(chalk.gray("─".repeat(60)));
    }
  },

  blank() {
    if (shouldLog("info")) {
      console.log();
    }
  },
};
