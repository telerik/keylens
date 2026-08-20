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

  it("should not flag roving-tabindex members of an active composite widget", async () => {
    // W3C APG tabs pattern: only the active tab is a Tab stop (tabindex="0"),
    // the rest use tabindex="-1" and are reached via arrow keys, not Tab.
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({
            selector: "#tab-1",
            reached: true,
            tabindexAttr: null,
            rovingContainerSelector: "#tablist",
          }),
          makeInteractiveElement({
            selector: "#tab-2",
            reached: false,
            tabindexAttr: -1,
            rovingContainerSelector: "#tablist",
          }),
          makeInteractiveElement({
            selector: "#tab-3",
            reached: false,
            tabindexAttr: -1,
            rovingContainerSelector: "#tablist",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should still flag a composite widget whose members are all unreachable", async () => {
    // No member of the group ever received focus, so the widget isn't
    // reachable at all - a genuine keyboard trap, not a benign roving pattern.
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({
            selector: "#tab-1",
            reached: false,
            tabindexAttr: null,
            rovingContainerSelector: "#tablist",
          }),
          makeInteractiveElement({
            selector: "#tab-2",
            reached: false,
            tabindexAttr: -1,
            rovingContainerSelector: "#tablist",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations[0].elements).toHaveLength(2);
  });

  it("should not flag composite widget members when the container itself (not any member) was reached via Tab", async () => {
    // jQuery UI menu pattern: the container (role="menu", tabindex="0") keeps
    // real DOM focus for its whole lifetime; arrow keys move an internal
    // highlight without ever moving focus onto an individual menuitem. No
    // member has tabindex="0", but the container itself proves the widget is
    // enterable by keyboard.
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({
            selector: "#menu",
            reached: true,
            tabindexAttr: 0,
          }),
          makeInteractiveElement({
            selector: "#menu > li:nth-of-type(1)",
            reached: false,
            tabindexAttr: -1,
            rovingContainerSelector: "#menu",
          }),
          makeInteractiveElement({
            selector: "#menu > li:nth-of-type(2)",
            reached: false,
            tabindexAttr: -1,
            rovingContainerSelector: "#menu",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
