import { writeFile, mkdir } from "fs/promises";
import { resolve } from "path";
import { logger } from "./logger.js";
import { throwIfAborted } from "./execution.js";
import type { KeylensConfig } from "../types/index.js";

/**
 * Build a report file name from the configured base name/timestamp policy.
 * Defaults to "keylens-report-<timestamp>.<extension>" so repeated runs
 * against the same outputDir never silently overwrite a prior report;
 * `config.outputFileName` overrides the base name (e.g. a URL-derived
 * prefix for batch runs) and `config.appendTimestamp` opts back out to a
 * stable name for callers that manage uniqueness themselves (CI artifacts).
 */
export function buildReportFileName(
  defaultBaseName: string,
  extension: string,
  config: Pick<KeylensConfig, "outputFileName" | "appendTimestamp">,
  timestamp: string,
): string {
  const baseName = config.outputFileName?.trim() || defaultBaseName;
  const suffix = config.appendTimestamp
    ? `-${timestamp.replace(/\.\d{3}Z$/, "").replace(/:/g, "-")}`
    : "";
  return `${baseName}${suffix}.${extension}`;
}

/**
 * Ensure the output directory exists, write a report file into it, and log a
 * success message. Shared by the JSON/HTML/Markdown reporters to avoid
 * repeating the same mkdir/writeFile/log sequence in each one.
 *
 * Checks `signal` for cancellation both before creating the directory and
 * before writing the file, matching the two-checkpoint pattern the reporters
 * previously implemented individually.
 */
export async function writeReportFile(
  outputDir: string,
  fileName: string,
  content: string,
  reportLabel: string,
  signal?: AbortSignal,
  url?: string,
): Promise<void> {
  throwIfAborted(signal, "reporters", url);
  const dir = outputDir || process.cwd();
  await mkdir(dir, { recursive: true });
  throwIfAborted(signal, "reporters", url);

  const filePath = resolve(dir, fileName);
  await writeFile(filePath, content, { encoding: "utf-8", signal });

  logger.success(`${reportLabel} report saved to ${filePath}`);
}
