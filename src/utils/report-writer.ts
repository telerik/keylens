import { writeFile, mkdir } from "fs/promises";
import { resolve, basename, sep } from "path";
import { logger } from "./logger.js";
import { throwIfAborted } from "./execution.js";
import { ConfigError } from "../errors.js";
import type { KeylensConfig } from "../types/index.js";

/**
 * Build a report file name from the configured base name/timestamp policy.
 * Defaults to "keylens-report-<timestamp>.<extension>" so repeated runs
 * against the same outputDir never silently overwrite a prior report;
 * `config.outputFileName` overrides the base name (e.g. a URL-derived
 * prefix for batch runs) and `config.appendTimestamp` opts back out to a
 * stable name for callers that manage uniqueness themselves (CI artifacts).
 *
 * `outputFileName` can come from untrusted callers (e.g. an MCP tool
 * argument), so it's reduced to a bare file-name component — `basename()`
 * strips any directory segments (including `..` traversal and absolute
 * paths), preventing writes outside `outputDir`.
 */
export function buildReportFileName(
  defaultBaseName: string,
  extension: string,
  config: Pick<KeylensConfig, "outputFileName" | "appendTimestamp">,
  timestamp: string,
): string {
  const trimmed = config.outputFileName?.trim();
  const baseName = (trimmed && basename(trimmed)) || defaultBaseName;
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
 *
 * Confines the write to `outputDir`: `fileName` is expected to be a bare
 * file name (see `buildReportFileName`), but this is re-verified here as a
 * defense-in-depth check against any caller passing a path-like value
 * directly, since `outputDir`/`fileName` may originate from an MCP tool
 * argument rather than a trusted CLI flag.
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

  const resolvedDir = resolve(dir);
  const filePath = resolve(resolvedDir, basename(fileName));
  if (filePath !== resolvedDir && !filePath.startsWith(resolvedDir + sep)) {
    throw new ConfigError(
      `Refusing to write report outside of output directory: ${filePath}`,
    );
  }
  await writeFile(filePath, content, { encoding: "utf-8", signal });

  logger.success(`${reportLabel} report saved to ${filePath}`);
}
