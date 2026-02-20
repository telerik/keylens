import { describe, it, expect } from "vitest";
import { FocusOrderMismatchRule } from "@/rules/focus-order-mismatch.js";
import {
  makeFocusedElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

describe("FocusOrderMismatchRule", () => {
  const rule = new FocusOrderMismatchRule();

  it("should pass when focus order matches visual order", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.nav",
            boundingRect: { x: 0, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.nav-2",
            boundingRect: { x: 120, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "button.main",
            boundingRect: { x: 0, y: 100, width: 100, height: 40 },
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should pass with fewer than 2 elements", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.solo" }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when focus order significantly differs from visual order", async () => {
    // Visual order: top-of-page element, then far-down element
    // Focus order: far-down element first (position diff > 3)
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "button.footer",
            boundingRect: { x: 0, y: 2000, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.header-1",
            boundingRect: { x: 0, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "a.header-2",
            boundingRect: { x: 120, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 4,
            selector: "a.header-3",
            boundingRect: { x: 240, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 5,
            selector: "a.header-4",
            boundingRect: { x: 360, y: 0, width: 100, height: 40 },
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].severity).toBe("warning");
  });

  it("should group elements in the same row within 50px threshold", async () => {
    // Two elements on the same visual row (within 50px), left-to-right order matches focus order
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.left",
            boundingRect: { x: 0, y: 100, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.right",
            boundingRect: { x: 200, y: 130, width: 100, height: 40 },
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should pass with 3+ elements in same row in left-to-right order", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "button.col1",
            boundingRect: { x: 0, y: 100, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "button.col2",
            boundingRect: { x: 120, y: 110, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "button.col3",
            boundingRect: { x: 240, y: 105, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 4,
            selector: "button.col4",
            boundingRect: { x: 360, y: 100, width: 100, height: 40 },
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when focus order is reversed vs visual order (diff > 3)", async () => {
    // Focus visits the last visual element first — position diff > 3 triggers violation
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "button.last-visual",
            boundingRect: { x: 0, y: 500, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "button.a",
            boundingRect: { x: 0, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "button.b",
            boundingRect: { x: 120, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 4,
            selector: "button.c",
            boundingRect: { x: 240, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 5,
            selector: "button.d",
            boundingRect: { x: 360, y: 0, width: 100, height: 40 },
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations[0].severity).toBe("warning");
  });

  it("should tolerate minor deviations (position diff <= 3)", async () => {
    // Element is 2 positions off from visual order — within tolerance
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.first",
            boundingRect: { x: 0, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.third-visual",
            boundingRect: { x: 0, y: 200, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "a.second-visual",
            boundingRect: { x: 0, y: 100, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 4,
            selector: "a.fourth",
            boundingRect: { x: 0, y: 300, width: 100, height: 40 },
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });
});
