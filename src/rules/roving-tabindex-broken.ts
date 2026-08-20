import type { Rule, CrawlResult, RuleResult } from "../types/index.js";

/**
 * Detects composite widget members (e.g. tabs, menu items, listbox options)
 * that follow the roving-tabindex markup pattern (`tabindex="-1"` on inactive
 * members) but are NOT actually reachable via arrow keys from the active
 * member - a broken or missing keydown handler.
 *
 * This is distinct from `unreachable-elements`: that rule only checks whether
 * the composite CONTAINER is reachable via Tab. This rule verifies the
 * roving-tabindex pattern is actually wired up correctly once inside it.
 *
 * Reported as a warning (not error) because the arrow-key simulation used to
 * verify this is a best-effort heuristic - inferred orientation or timing
 * quirks could occasionally under-detect reachability that a real user would
 * find fine, so results warrant manual confirmation before treating as a
 * hard failure.
 */
export class RovingTabindexBrokenRule implements Rule {
  id = "roving-tabindex-broken";
  name = "Broken Roving Tabindex Navigation";
  description =
    "Detects composite widget members (tabs, menu items, options, etc.) that are not reachable via arrow keys from the active member, despite following the roving-tabindex markup pattern.";
  severity = "warning" as const;
  wcag = ["2.1.1"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const groups = crawlResult.rovingTabindexGroups ?? [];
    const outerHTMLBySelector = new Map(
      crawlResult.interactiveElements.map((el) => [el.selector, el.outerHTML]),
    );
    const accessibleNameBySelector = new Map(
      crawlResult.interactiveElements.map((el) => [
        el.selector,
        el.accessibleName,
      ]),
    );

    for (const group of groups) {
      if (group.unreachedViaArrowKeys.length === 0) continue;

      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message: `${group.unreachedViaArrowKeys.length} of ${group.totalMembers} member(s) of this ${group.containerRole} could not be reached via arrow keys from the active item.`,
        elements: group.unreachedViaArrowKeys.map((selector) => ({
          selector,
          outerHTML: outerHTMLBySelector.get(selector) ?? "",
          accessibleName: accessibleNameBySelector.get(selector) || undefined,
        })),
        wcag: this.wcag,
        impact:
          'Keyboard users who tab into this composite widget cannot reach these members with arrow keys, even though the markup declares the roving-tabindex pattern (tabindex="-1"). This likely indicates a missing or broken keydown handler.',
      });
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      status: violations.length === 0 ? "passed" : "failed",
      violations,
      duration: 0,
    };
  }
}
