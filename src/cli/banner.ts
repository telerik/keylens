import chalk from "chalk";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const LOGO = [
  "██╗  ██╗███████╗██╗   ██╗██╗     ███████╗███╗   ██╗███████╗",
  "██║ ██╔╝██╔════╝╚██╗ ██╔╝██║     ██╔════╝████╗  ██║██╔════╝",
  "█████╔╝ █████╗   ╚████╔╝ ██║     █████╗  ██╔██╗ ██║███████╗",
  "██╔═██╗ ██╔══╝    ╚██╔╝  ██║     ██╔══╝  ██║╚██╗██║╚════██║",
  "██║  ██╗███████╗   ██║   ███████╗███████╗██║ ╚████║███████║",
  "╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝",
];

const LOGO_WIDTH = Math.max(...LOGO.map((line) => line.length));
const INDENT = "  ";
const TAGLINE = "See your site through the lens of keyboard users.";

const GRADIENT_START: [number, number, number] = [34, 211, 238];
const GRADIENT_END: [number, number, number] = [168, 85, 247];

export interface BannerEnvironment {
  isTTY: boolean;
  columns?: number;
  env: NodeJS.ProcessEnv;
}

function gradientColor(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  const [r, g, b] = GRADIENT_START.map((start, i) =>
    Math.round(start + (GRADIENT_END[i] - start) * t),
  );
  return chalk.rgb(r, g, b)(LOGO[index]);
}

/** Full ASCII art needs an interactive, wide-enough terminal outside CI. */
export function canShowFullBanner(environment: BannerEnvironment): boolean {
  if (!environment.isTTY || environment.env.CI) return false;
  const columns = environment.columns ?? 0;
  return columns >= LOGO_WIDTH + INDENT.length;
}

export function renderCompactBanner(version: string): string {
  return `
${chalk.cyan.bold("Keylens")} ${chalk.gray(`v${version}`)}
${chalk.gray(TAGLINE)}
`;
}

export function renderFullBanner(version: string): string {
  const logo = LOGO.map(
    (_, index) => INDENT + gradientColor(index, LOGO.length),
  );
  return [
    "",
    ...logo,
    `${INDENT}${chalk.gray(TAGLINE)} ${chalk.gray(`v${version}`)}`,
    "",
  ].join("\n");
}

export function renderQuickStart(): string {
  const command = (text: string) => chalk.cyan(text);
  return [
    `${INDENT}${chalk.bold("Get started")}`,
    `${INDENT}  ${command("keylens audit https://example.com")}  ${chalk.gray("Tab through a page and report issues")}`,
    `${INDENT}  ${command("keylens audit <url> -o html")}         ${chalk.gray("Generate a visual focus-order report")}`,
    `${INDENT}  ${command("keylens init")}                        ${chalk.gray("Create a keylens.config.json")}`,
    `${INDENT}  ${command("keylens --help")}                      ${chalk.gray("See all commands and options")}`,
    "",
    `${INDENT}${chalk.gray("Docs: https://github.com/telerik/keylens")}`,
    "",
  ].join("\n");
}

/** Banner for a bare `keylens` invocation: logo (when it fits) plus quick-start hints. */
export function renderWelcome(
  version: string,
  environment: BannerEnvironment,
): string {
  const banner = canShowFullBanner(environment)
    ? renderFullBanner(version)
    : renderCompactBanner(version);
  return `${banner}\n${renderQuickStart()}`;
}

function welcomeStatePath(stateDir: string): string {
  return join(stateDir, "welcome-shown");
}

export function defaultStateDir(): string {
  return join(homedir(), ".keylens");
}

/** Never throws: an unreadable home directory just means "not seen yet". */
export function hasSeenWelcome(stateDir = defaultStateDir()): boolean {
  try {
    return existsSync(welcomeStatePath(stateDir));
  } catch {
    return false;
  }
}

/** Never throws: a read-only filesystem must not block a CLI run. */
export function markWelcomeSeen(stateDir = defaultStateDir()): void {
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(welcomeStatePath(stateDir), "1", "utf-8");
  } catch {
    // Ignore: the banner will simply be shown again next time.
  }
}

/**
 * Banner printed at the start of `keylens audit`: the full ASCII logo on the
 * first interactive run on a machine, the compact one-liner otherwise.
 */
export function renderAuditBanner(
  version: string,
  environment: BannerEnvironment,
  stateDir = defaultStateDir(),
): string {
  if (canShowFullBanner(environment) && !hasSeenWelcome(stateDir)) {
    markWelcomeSeen(stateDir);
    return renderFullBanner(version);
  }
  return renderCompactBanner(version);
}
