import chalk from "chalk";
import type { HelpConfiguration } from "commander";

export const HELP_STYLE: HelpConfiguration = {
  styleTitle: (title) => chalk.bold.magenta(title),
  styleCommandText: (text) => chalk.bold.cyan(text),
  styleSubcommandTerm: (term) => chalk.cyan(term),
  styleOptionTerm: (term) => chalk.cyan(term),
  styleArgumentTerm: (term) => chalk.yellow(term),
};

function renderExamples(examples: [string, string][]): string {
  const width = Math.max(...examples.map(([command]) => command.length));
  const lines = examples.map(
    ([command, description]) =>
      `  ${chalk.cyan(command.padEnd(width))}  ${chalk.gray(description)}`,
  );
  return `\n${chalk.bold.magenta("Examples:")}\n${lines.join("\n")}\n`;
}

export const PROGRAM_HELP_FOOTER =
  renderExamples([
    ["keylens https://example.com", "Audit a page (shorthand for audit)"],
    ["keylens audit <url> -o html", "Write a visual focus-order report"],
    ["keylens init", "Create a keylens.config.json"],
    ["keylens audit --help", "See every audit option"],
  ]) + `\n${chalk.gray("Docs: https://github.com/telerik/keylens")}\n`;

export const AUDIT_HELP_FOOTER = renderExamples([
  ["keylens audit https://example.com", "Audit with the balanced profile"],
  ["keylens audit <url> -o cli,html,json", "Print results and write reports"],
  ["keylens audit <url> --profile thorough", "Tab further, wait longer"],
  [
    "keylens audit -c keylens.config.json",
    "Use the URL and settings from config",
  ],
  ["keylens audit <url> --interactions", "Also check focus after clicking"],
]);
