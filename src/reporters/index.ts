import type { AuditReport, ReporterType } from "../types/index.js";
import { reportCLI } from "./cli-reporter.js";
import { reportJSON } from "./json-reporter.js";
import { reportHTML } from "./html-reporter.js";
import { reportMarkdown } from "./markdown-reporter.js";
import { throwIfAborted } from "../utils/execution.js";
import { ReporterError } from "../errors.js";

export { serializeJSON } from "./json-reporter.js";
export { renderHTML } from "./html-reporter.js";
export { renderMarkdown } from "./markdown-reporter.js";

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
