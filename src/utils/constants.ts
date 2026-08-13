/**
 * Shared constants used across crawler and rules modules.
 */

/** Max characters kept when falling back to `textContent` for an accessible name. */
export const TEXT_PREVIEW_LENGTH = 100;

/** Max characters kept when capturing an element's `outerHTML` for reports. */
export const HTML_PREVIEW_LENGTH = 300;

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
