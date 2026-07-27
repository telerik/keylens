import { writeFile, mkdir } from "fs/promises";
import { resolve } from "path";
import type { AuditReport, MultiPageReport } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { throwIfAborted } from "../utils/execution.js";

/**
 * Output audit results as a JSON file for CI/CD integration.
 */
export async function reportJSON(
  report: AuditReport,
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal, "reporters", report.url);
  const dir = outputDir || process.cwd();
  await mkdir(dir, { recursive: true });
  throwIfAborted(signal, "reporters", report.url);

  const jsonReport = stripScreenshots(report);

  const filePath = resolve(dir, "keylens-report.json");
  await writeFile(filePath, JSON.stringify(jsonReport, null, 2), {
    encoding: "utf-8",
    signal,
  });

  logger.success(`JSON report saved to ${filePath}`);
}

function stripScreenshots(report: AuditReport) {
  return {
    ...report,
    pageScreenshot: undefined,
    focusSequence: report.focusSequence?.map((el) => ({
      ...el,
      focusedScreenshot: undefined,
      unfocusedScreenshot: undefined,
    })),
  };
}

/**
 * Output multi-page audit results as a single JSON file.
 */
export async function reportMultiJSON(
  report: MultiPageReport,
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal, "reporters");
  const dir = outputDir || process.cwd();
  await mkdir(dir, { recursive: true });
  throwIfAborted(signal, "reporters");

  const jsonReport = {
    ...report,
    pages: report.pages.map(stripScreenshots),
  };

  const filePath = resolve(dir, "keylens-report.json");
  await writeFile(filePath, JSON.stringify(jsonReport, null, 2), {
    encoding: "utf-8",
    signal,
  });

  logger.success(`JSON report saved to ${filePath}`);
}
