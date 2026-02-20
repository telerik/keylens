import { describe, it, expect } from "vitest";
import { TabindexAbuseRule } from "@/rules/tabindex-abuse.js";
import {
  makeInteractiveElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

describe("TabindexAbuseRule", () => {
  const rule = new TabindexAbuseRule();

  it("should pass when no elements have positive tabindex", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ tabindexAttr: null }),
          makeInteractiveElement({ tabindexAttr: 0 }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when an element has positive tabindex", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ tabindexAttr: null }),
          makeInteractiveElement({
            selector: "input.search",
            tabindexAttr: 5,
            outerHTML: '<input tabindex="5" class="search">',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("warning");
    expect(result.violations[0].elements[0].selector).toBe("input.search");
  });

  it("should not flag negative tabindex", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [makeInteractiveElement({ tabindexAttr: -1 })],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should flag all elements with positive tabindex", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({
            selector: "input.first",
            tabindexAttr: 5,
          }),
          makeInteractiveElement({
            selector: "input.second",
            tabindexAttr: 0,
          }),
          makeInteractiveElement({
            selector: "input.third",
            tabindexAttr: 10,
          }),
          makeInteractiveElement({
            selector: "button.ok",
            tabindexAttr: -1,
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].elements).toHaveLength(2);
  });

  it("should pass with empty interactive elements", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
