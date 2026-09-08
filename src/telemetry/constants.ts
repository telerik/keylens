/**
 * Shared telemetry vocabulary — only symbols genuinely used across more
 * than one file. Anything used in exactly one place lives as a local
 * constant in that file instead. See src/telemetry/README.md for the full
 * data-collection policy.
 */

/** Which entry point produced this audit run. Maps to the telemetry event's `Source` field. */
export const Source = {
  Cli: "KeylensCLI",
  Mcp: "KeylensMCPTool",
  Library: "KeylensLibrary",
} as const;
export type SourceValue = (typeof Source)[keyof typeof Source];

// Shared opt-out honored across Telerik developer tools, so one
// environment variable silences telemetry everywhere. Part of the public
// API (re-exported from src/index.ts and documented in README.md).
export const ENV_TELERIK_TELEMETRY_OFF = "TELERIK_TELEMETRY_OFF";
// Product-specific opt-out, for callers who only want to silence Keylens.
// Also part of the public API.
export const ENV_KEYLENS_TELEMETRY_OFF = "KEYLENS_TELEMETRY_OFF";
