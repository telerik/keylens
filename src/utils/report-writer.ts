import { writeFile, mkdir } from "fs/promises";
import { resolve } from "path";
import { logger } from "./logger.js";
import { throwIfAborted } from "./execution.js";

/**
 * Ensure the output directory exists, write a report file into it, and log a
 * success message. Shared by the JSON/HTML/Markdown reporters (single- and
 * multi-page variants) to avoid repeating the same mkdir/writeFile/log
 * sequence in each one.
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
