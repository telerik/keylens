/**
 * Shared constants used across crawler and rules modules.
 */

/** Patterns for matching skip navigation links by accessible name. */
export const SKIP_LINK_PATTERNS: ReadonlyArray<RegExp> = [
  /skip.*(?:nav|content|main)/i,
  /jump.*(?:nav|content|main)/i,
  /go.*to.*(?:content|main)/i,
  /skip.*to/i,
];

/** CSS selectors for main content target regions. */
export const MAIN_CONTENT_SELECTORS: ReadonlyArray<string> = [
  "main",
  "[role='main']",
  "#main-content",
  "#content",
  "#main",
];
