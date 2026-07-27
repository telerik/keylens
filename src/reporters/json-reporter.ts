import { writeFile, mkdir } from "fs/promises";
import { resolve } from "path";
import type { AuditReport, MultiPageReport } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { throwIfAborted } from "../utils/execution.js";
import { projectAuditReport, projectMultiPageReport } from "../utils/assets.js";

export function serializeJSON(report: AuditReport, pretty = true): string {
  return JSON.stringify(
    projectAuditReport(report, { assets: "omit" }),
    null,
    pretty ? 2 : undefined,
  );
}

export function serializeMultiJSON(
  report: MultiPageReport,
  pretty = true,
): string {
  return JSON.stringify(
    projectMultiPageReport(report, { assets: "omit" }),
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
  throwIfAborted(signal, "reporters", report.url);
  const dir = outputDir || process.cwd();
  await mkdir(dir, { recursive: true });
  throwIfAborted(signal, "reporters", report.url);

  const filePath = resolve(dir, "keylens-report.json");
  await writeFile(filePath, serializeJSON(report), {
    encoding: "utf-8",
    signal,
  });

  logger.success(`JSON report saved to ${filePath}`);
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

  const filePath = resolve(dir, "keylens-report.json");
  await writeFile(filePath, serializeMultiJSON(report), {
    encoding: "utf-8",
    signal,
  });

  logger.success(`JSON report saved to ${filePath}`);
}
