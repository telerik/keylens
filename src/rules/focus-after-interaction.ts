import type { Rule, CrawlResult, RuleResult } from "../types/index.js";

/**
 * Focus After Interaction rule (WCAG 2.4.3 / 2.4.7).
 *
 * After clicking a button or interactive widget, focus should remain on the element,
 * move to a logical target (e.g. opened dialog), or at minimum not be lost entirely.
 * Detects cases where focus reverts to <body> after interaction.
 */
export class FocusAfterInteractionRule implements Rule {
  id = "focus-after-interaction";
  name = "Focus After Interaction";
  description =
    "Ensures focus is not lost after clicking interactive elements.";
  severity = "error" as const;
  wcag = ["2.4.3", "2.4.7"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const interactions = crawlResult.interactionResults ?? [];

    const failedInteractions = interactions.filter((r) => !r.focusReasonable);

    if (failedInteractions.length === 0) {
      return {
        ruleId: this.id,
        passed: true,
        violations: [],
        duration: 0,
      };
    }

    return {
      ruleId: this.id,
      passed: false,
      violations: failedInteractions.map((r) => ({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message: r.issue ?? `Focus lost after clicking ${r.element.selector}`,
        elements: [
          {
            selector: r.element.selector,
            outerHTML: `<${r.element.tagName} role="${r.element.role}">${r.element.accessibleName}</${r.element.tagName}>`,
            accessibleName: r.element.accessibleName || undefined,
          },
        ],
        wcag: this.wcag,
        impact:
          "Keyboard users lose their position on the page after interacting with this element, forcing them to Tab from the beginning.",
      })),
      duration: 0,
    };
  }
}
