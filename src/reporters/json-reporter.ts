import type { AuditReport } from "../types/index.js";
import {
  writeReportFile,
  buildReportFileName,
} from "../utils/report-writer.js";
import { projectAuditReport } from "../utils/assets.js";

export function serializeJSON(report: AuditReport, pretty = true): string {
  return JSON.stringify(
    projectAuditReport(report, { assets: "omit" }),
    null,
    pretty ? 2 : undefined,
  );
}

/**
 * Output audit results as a JSON file for CI/CD integration.
 */
export async function reportJSON(
  report: AuditReport,
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  await writeReportFile(
    outputDir,
    buildReportFileName(
      "keylens-report",
      "json",
      report.config,
      report.timestamp,
    ),
    serializeJSON(report),
    "JSON",
    signal,
    report.url,
  );
}
