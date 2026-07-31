import { describe, expect, it } from "vitest";
import {
  RULE_CATALOG,
  getRuleCatalog,
  getRuleRemediation,
  getWcagReference,
} from "@/guidance.js";

describe("rule guidance", () => {
  it("provides remediation for every public rule", () => {
    expect(getRuleCatalog()).toBe(RULE_CATALOG);
    expect(RULE_CATALOG).toHaveLength(8);
    expect(new Set(RULE_CATALOG.map((rule) => rule.ruleId)).size).toBe(8);

    for (const rule of RULE_CATALOG) {
      expect(rule.guidance.length).toBeGreaterThan(20);
      expect(rule.wcag.length).toBeGreaterThan(0);
      expect(getRuleRemediation(rule.ruleId)).toBe(rule);
    }
  });

  it("resolves canonical WCAG references independently of rules", () => {
    expect(getWcagReference("2.4.3")).toEqual({
      id: "2.4.3",
      title: "Focus Order",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
    });
    expect(getWcagReference("9.9.9")).toBeUndefined();
  });

  it("cannot be mutated by consumers", () => {
    const skipLink = getRuleRemediation("skip-link")!;
    expect(Object.isFrozen(RULE_CATALOG)).toBe(true);
    expect(Object.isFrozen(skipLink)).toBe(true);
    expect(Object.isFrozen(skipLink.wcag)).toBe(true);
    expect(Object.isFrozen(skipLink.wcag[0])).toBe(true);
    expect(() => {
      (skipLink as { title: string }).title = "Changed";
    }).toThrow(TypeError);
    expect(getRuleRemediation("skip-link")?.title).toBe(
      "Provide a way to bypass repeated content",
    );
  });
});
