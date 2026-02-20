import { describe, it, expect } from "vitest";
import { FocusNotObscuredRule } from "@/rules/focus-not-obscured.js";
import {
  makeFocusedElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

describe("FocusNotObscuredRule", () => {
  const rule = new FocusNotObscuredRule();

  it("should pass when no elements are obscured", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, isObscured: false }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.link",
            isObscured: false,
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when an element is obscured by overlapping content", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, isObscured: false }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.hidden-link",
            isObscured: true,
            outerHTML: '<a class="hidden-link" href="/about">About</a>',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("error");
    expect(result.violations[0].wcag).toContain("2.4.11");
    expect(result.violations[0].elements[0].selector).toBe("a.hidden-link");
  });

  it("should pass with empty focus sequence", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should list multiple obscured elements in a single violation", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.link-1",
            isObscured: true,
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "button.btn",
            isObscured: false,
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "a.link-2",
            isObscured: true,
          }),
          makeFocusedElement({
            tabIndex: 4,
            selector: "input.field",
            isObscured: true,
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].elements).toHaveLength(3);
    expect(result.violations[0].message).toContain("3");
  });

  it("should pass when isObscured is undefined (not checked)", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1 }), // isObscured not set
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });
});
