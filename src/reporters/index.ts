import type {
  AuditReport,
  ReporterType,
  WrittenReport,
} from "../types/index.js";
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
 * Returns the files written by the file reporters, in reporter order.
 */
export async function runReporters(
  report: AuditReport,
  reporters: ReporterType[],
  outputDir: string,
  signal?: AbortSignal,
): Promise<WrittenReport[]> {
  const written: WrittenReport[] = [];
  try {
    for (const reporter of reporters) {
      throwIfAborted(signal, "reporters", report.url);
      switch (reporter) {
        case "cli":
          reportCLI(report);
          break;
        case "json":
          written.push({
            type: "json",
            path: await reportJSON(report, outputDir, signal),
          });
          break;
        case "html":
          written.push({
            type: "html",
            path: await reportHTML(report, outputDir, signal),
          });
          break;
        case "markdown":
          written.push({
            type: "markdown",
            path: await reportMarkdown(report, outputDir, signal),
          });
          break;
      }
    }
    return written;
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
