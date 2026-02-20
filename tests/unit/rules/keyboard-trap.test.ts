import { describe, it, expect } from "vitest";
import { KeyboardTrapRule } from "@/rules/keyboard-trap.js";
import {
  makeFocusedElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

describe("KeyboardTrapRule", () => {
  const rule = new KeyboardTrapRule();

  it("should pass when there are no traps", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.link-1" }),
          makeFocusedElement({ tabIndex: 2, selector: "button.btn-1" }),
          makeFocusedElement({ tabIndex: 3, selector: "input.field-1" }),
        ],
        cycleCompleted: true,
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should detect consecutive duplicate elements as a trap", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.link-1" }),
          makeFocusedElement({ tabIndex: 2, selector: "div.combobox" }),
          makeFocusedElement({ tabIndex: 3, selector: "div.combobox" }),
          makeFocusedElement({ tabIndex: 4, selector: "button.btn-1" }),
        ],
        cycleCompleted: true,
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("error");
    expect(result.violations[0].elements[0].selector).toBe("div.combobox");
  });

  it("should warn when tab cycle does not complete", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.link-1" }),
        ],
        cycleCompleted: false,
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("warning");
  });

  it("should detect 3+ consecutive duplicate elements as trap", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.link-1" }),
          makeFocusedElement({ tabIndex: 2, selector: "div.modal" }),
          makeFocusedElement({ tabIndex: 3, selector: "div.modal" }),
          makeFocusedElement({ tabIndex: 4, selector: "div.modal" }),
          makeFocusedElement({ tabIndex: 5, selector: "button.close" }),
        ],
        cycleCompleted: true,
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].elements[0].selector).toBe("div.modal");
  });

  it("should warn with single-element focus sequence and incomplete cycle", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "button.only" }),
        ],
        cycleCompleted: false,
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("warning");
  });

  it("should pass with an empty focus sequence and completed cycle", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [],
        cycleCompleted: true,
      }),
    );

    expect(result.passed).toBe(true);
  });
});
