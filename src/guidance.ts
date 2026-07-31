import type { RuleRemediation, WcagReference } from "./types/index.js";

const WCAG_REFERENCES: Readonly<Record<string, WcagReference>> = {
  "1.3.1": {
    id: "1.3.1",
    title: "Info and Relationships",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  },
  "1.3.2": {
    id: "1.3.2",
    title: "Meaningful Sequence",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html",
  },
  "2.1.1": {
    id: "2.1.1",
    title: "Keyboard",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
  },
  "2.1.2": {
    id: "2.1.2",
    title: "No Keyboard Trap",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html",
  },
  "2.4.1": {
    id: "2.4.1",
    title: "Bypass Blocks",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html",
  },
  "2.4.3": {
    id: "2.4.3",
    title: "Focus Order",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
  },
  "2.4.7": {
    id: "2.4.7",
    title: "Focus Visible",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
  },
  "2.4.11": {
    id: "2.4.11",
    title: "Focus Not Obscured (Minimum)",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html",
  },
  "2.4.12": {
    id: "2.4.12",
    title: "Focus Not Obscured (Enhanced)",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-enhanced.html",
  },
  "4.1.2": {
    id: "4.1.2",
    title: "Name, Role, Value",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  },
};
for (const reference of Object.values(WCAG_REFERENCES)) {
  Object.freeze(reference);
}
Object.freeze(WCAG_REFERENCES);

const wcag = (...ids: string[]): readonly WcagReference[] =>
  Object.freeze(ids.map((id) => WCAG_REFERENCES[id]!));

const RULE_CATALOG_DATA: RuleRemediation[] = [
  {
    ruleId: "keyboard-trap",
    title: "Remove the keyboard trap",
    description:
      "Detects elements that trap keyboard focus, preventing users from navigating away.",
    severity: "error",
    guidance:
      "Ensure users can leave every widget using its documented keyboard interaction. Modal dialogs, date pickers, and other composite widgets need an explicit exit path and must restore focus to a logical destination.",
    codeExample: `dialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    dialog.close();
    trigger.focus();
  }
});`,
    wcag: wcag("2.1.2"),
  },
  {
    ruleId: "unreachable-elements",
    title: "Make interactive controls keyboard reachable",
    description:
      "Detects interactive elements that cannot be reached via keyboard navigation.",
    severity: "error",
    guidance:
      "Prefer native interactive elements. Custom controls need correct semantics, keyboard activation, and placement in the appropriate Tab or composite-widget arrow-key sequence.",
    codeExample: `<button type="button">Continue</button>`,
    wcag: wcag("2.1.1"),
  },
  {
    ruleId: "focus-order-mismatch",
    title: "Align focus order with the logical page sequence",
    description:
      "Detects when keyboard focus order doesn't match the visual layout order.",
    severity: "warning",
    guidance:
      "Keep DOM, reading, and operation order logical for the page language and direction. Avoid positive tabindex values and CSS reordering that creates a confusing sequence.",
    codeExample: `<!-- Put controls in their intended order and rely on DOM order. -->
<input name="first">
<input name="second">`,
    wcag: wcag("2.4.3"),
  },
  {
    ruleId: "tabindex-abuse",
    title: "Remove positive tabindex values",
    description:
      "Detects elements with positive tabindex values that disrupt natural focus order.",
    severity: "warning",
    guidance:
      'Use native controls in DOM order. Use tabindex="0" only when a custom control must join the natural sequence and tabindex="-1" only for intentional programmatic focus.',
    codeExample: `<button type="button">Item</button>`,
    wcag: wcag("2.4.3"),
  },
  {
    ruleId: "missing-focus-indicator",
    title: "Add visible focus indicators",
    description:
      "Detects interactive elements that lack a visible focus indicator.",
    severity: "warning",
    guidance:
      "Provide a clearly discernible focus style on every supported background. Do not remove the browser outline unless an equally visible alternative replaces it.",
    codeExample: `:focus-visible {
  outline: 2px solid var(--focus-ring-color);
  outline-offset: 2px;
}`,
    wcag: wcag("2.4.7"),
  },
  {
    ruleId: "skip-link",
    title: "Provide a way to bypass repeated content",
    description:
      "Validates that a skip navigation link is present and functions correctly.",
    severity: "warning",
    guidance:
      "Provide a skip link or another mechanism that bypasses repeated navigation. Make the control visible on focus and ensure its target receives the expected focus.",
    codeExample: `<a href="#main-content" class="skip-link">Skip to main content</a>
<main id="main-content" tabindex="-1">...</main>`,
    wcag: wcag("2.4.1"),
  },
  {
    ruleId: "focus-not-obscured",
    title: "Keep focused elements visible",
    description:
      "Ensures focused elements are not entirely hidden by sticky/fixed content.",
    severity: "error",
    guidance:
      "Ensure author-created overlays and sticky regions do not fully cover the focused element. Prefer layout-aware scroll-padding or scroll-margin using shared size tokens.",
    codeExample: `html {
  scroll-padding-block-start: var(--sticky-header-height);
}`,
    wcag: wcag("2.4.11"),
  },
  {
    ruleId: "focus-after-interaction",
    title: "Manage focus after activation",
    description:
      "Ensures focus is not lost after clicking interactive elements.",
    severity: "error",
    guidance:
      "After an activation changes context or removes the active control, move focus to a deterministic logical target. Restore focus to the trigger or another appropriate control when transient UI closes.",
    codeExample: `modal.showModal();
modal.querySelector("[autofocus]")?.focus();`,
    wcag: wcag("2.4.3", "2.4.7"),
  },
];
for (const rule of RULE_CATALOG_DATA) {
  Object.freeze(rule);
}
export const RULE_CATALOG: readonly RuleRemediation[] =
  Object.freeze(RULE_CATALOG_DATA);

const RULES_BY_ID = new Map(RULE_CATALOG.map((rule) => [rule.ruleId, rule]));

export function getRuleCatalog(): readonly RuleRemediation[] {
  return RULE_CATALOG;
}

export function getRuleRemediation(
  ruleId: string,
): RuleRemediation | undefined {
  return RULES_BY_ID.get(ruleId);
}

export function getWcagReference(id: string): WcagReference | undefined {
  return WCAG_REFERENCES[id];
}
