import type {
  AuditReport,
  MultiPageReport,
  ReporterType,
} from "../types/index.js";
import { reportCLI, reportMultiCLI } from "./cli-reporter.js";
import { reportJSON, reportMultiJSON } from "./json-reporter.js";
import { reportHTML, reportMultiHTML } from "./html-reporter.js";
import { reportMarkdown, reportMultiMarkdown } from "./markdown-reporter.js";
import { throwIfAborted } from "../utils/execution.js";
import { ReporterError } from "../errors.js";

export { serializeJSON, serializeMultiJSON } from "./json-reporter.js";
export { renderHTML, renderMultiHTML } from "./html-reporter.js";
export { renderMarkdown, renderMultiMarkdown } from "./markdown-reporter.js";

/**
 * Run all configured reporters to output single-page audit results.
 */
export async function runReporters(
  report: AuditReport,
  reporters: ReporterType[],
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    for (const reporter of reporters) {
      throwIfAborted(signal, "reporters", report.url);
      switch (reporter) {
        case "cli":
          reportCLI(report);
          break;
        case "json":
          await reportJSON(report, outputDir, signal);
          break;
        case "html":
          await reportHTML(report, outputDir, signal);
          break;
        case "markdown":
          await reportMarkdown(report, outputDir, signal);
          break;
      }
    }
  } catch (error) {
    throwIfAborted(signal, "reporters", report.url);
    if (error instanceof ReporterError) throw error;
    throw new ReporterError(
      `Reporter failed: ${(error as Error).message}`,
      report.url,
      {
        cause: error,
      },
    );
  }
}

/**
 * Run all configured reporters to output multi-page audit results.
 */
export async function runMultiReporters(
  report: MultiPageReport,
  reporters: ReporterType[],
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    for (const reporter of reporters) {
      throwIfAborted(signal, "reporters");
      switch (reporter) {
        case "cli":
          reportMultiCLI(report);
          break;
        case "json":
          await reportMultiJSON(report, outputDir, signal);
          break;
        case "html":
          await reportMultiHTML(report, outputDir, signal);
          break;
        case "markdown":
          await reportMultiMarkdown(report, outputDir, signal);
          break;
      }
    }
  } catch (error) {
    throwIfAborted(signal, "reporters");
    if (error instanceof ReporterError) throw error;
    throw new ReporterError(
      `Reporter failed: ${(error as Error).message}`,
      undefined,
      {
        cause: error,
      },
    );
  }
}
