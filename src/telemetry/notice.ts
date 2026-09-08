/**
 * One-time telemetry notice.
 *
 * Keylens' usage data (audit counts, options used, pass/fail results,
 * accessibility issue categories) is anonymous and aggregate on its own,
 * correlated with a one-way hashed machine identifier so installs can be
 * deduplicated.
 *
 * Telemetry must not be collected before this notice has been displayed.
 * The notice is shown at most once per machine (persisted under
 * `~/.keylens/`), the very first time telemetry actually becomes active
 * (i.e. an API key is configured and the user hasn't opted out) — showing
 * it earlier than that would be misleading, since nothing is collected
 * until then. Includes a link to Progress's Privacy Center.
 *
 * Never throws: a broken/read-only filesystem must never block a CLI,
 * MCP, or library run.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { ENV_KEYLENS_TELEMETRY_OFF } from "./constants.js";

/** Bumped whenever NOTICE_MESSAGE changes materially, to re-show it once. */
const NOTICE_VERSION = "1";

const NOTICE_MESSAGE =
  "Keylens collects anonymous, aggregate usage data (audit counts, options used, " +
  "pass/fail results, and accessibility issue categories) to help us improve the tool, " +
  "correlated with a one-way hashed machine identifier (never reversible to hardware " +
  "details).\n" +
  "No URLs, page content, selectors, accessible names, screenshots, reports, or IP " +
  "addresses are ever collected.\n" +
  `Opt out anytime by setting ${ENV_KEYLENS_TELEMETRY_OFF}=1 in your environment.\n` +
  "Privacy Center: https://www.progress.com/legal/privacy-center";

export const NOTICE_LINES = NOTICE_MESSAGE.split("\n");

function getStatePath(): string {
  return join(homedir(), ".keylens", "telemetry-notice-version");
}

/**
 * Shows the notice (to `writer`, default stderr so it never pollutes stdout
 * — important for the MCP server and `--json`-style CLI output) if it
 * hasn't been shown for the current NOTICE_VERSION yet. Returns whether it
 * was shown just now.
 */
export function ensureNoticeShown(
  writer: NodeJS.WritableStream = process.stderr,
): boolean {
  const path = getStatePath();
  try {
    if (
      existsSync(path) &&
      readFileSync(path, "utf-8").trim() === NOTICE_VERSION
    ) {
      return false;
    }
    const block = ["", "Telemetry", "---------", ...NOTICE_LINES, ""].join(
      "\n",
    );
    writer.write(block + "\n");
    mkdirSync(join(homedir(), ".keylens"), { recursive: true });
    writeFileSync(path, NOTICE_VERSION, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/** Test-only: force the notice to be re-evaluated as never-shown. */
export function _statePathForTests(): string {
  return getStatePath();
}
