import type {
  AuditReport,
  MultiPageReport,
  ReporterType,
} from "../types/index.js";
import { reportCLI, reportMultiCLI } from "./cli-reporter.js";
import { reportJSON, reportMultiJSON } from "./json-reporter.js";
import { reportHTML, reportMultiHTML } from "./html-reporter.js";
import { reportMarkdown, reportMultiMarkdown } from "./markdown-reporter.js";

/**
 * Run all configured reporters to output single-page audit results.
 */
export async function runReporters(
  report: AuditReport,
  reporters: ReporterType[],
  outputDir: string,
): Promise<void> {
  for (const reporter of reporters) {
    switch (reporter) {
      case "cli":
        reportCLI(report);
        break;
      case "json":
        await reportJSON(report, outputDir);
        break;
      case "html":
        await reportHTML(report, outputDir);
        break;
      case "markdown":
        await reportMarkdown(report, outputDir);
        break;
    }
  }
}

/**
 * Run all configured reporters to output multi-page audit results.
 */
export async function runMultiReporters(
  report: MultiPageReport,
  reporters: ReporterType[],
  outputDir: string,
): Promise<void> {
  for (const reporter of reporters) {
    switch (reporter) {
      case "cli":
        reportMultiCLI(report);
        break;
      case "json":
        await reportMultiJSON(report, outputDir);
        break;
      case "html":
        await reportMultiHTML(report, outputDir);
        break;
      case "markdown":
        await reportMultiMarkdown(report, outputDir);
        break;
    }
  }
}
