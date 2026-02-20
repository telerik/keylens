import { describe, it, expect } from "vitest";
import { UnreachableElementsRule } from "@/rules/unreachable-elements.js";
import {
  makeInteractiveElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

describe("UnreachableElementsRule", () => {
  const rule = new UnreachableElementsRule();

  it("should pass when all interactive elements are reached", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "a.link", reached: true }),
          makeInteractiveElement({ selector: "button.btn", reached: true }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when interactive elements are not reached", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "a.link", reached: true }),
          makeInteractiveElement({
            selector: "button.hidden-btn",
            reached: false,
          }),
          makeInteractiveElement({
            selector: "button.carousel-next",
            reached: false,
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].elements).toHaveLength(2);
    expect(result.violations[0].severity).toBe("error");
  });

  it("should list only unreached elements when most are reached", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "a.link-1", reached: true }),
          makeInteractiveElement({ selector: "a.link-2", reached: true }),
          makeInteractiveElement({ selector: "a.link-3", reached: true }),
          makeInteractiveElement({ selector: "button.btn-1", reached: true }),
          makeInteractiveElement({
            selector: "button.offscreen",
            reached: false,
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].elements).toHaveLength(1);
    expect(result.violations[0].elements[0].selector).toBe("button.offscreen");
  });

  it("should pass with no interactive elements", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [],
      }),
    );

    expect(result.passed).toBe(true);
  });
});
