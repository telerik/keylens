import { describe, it, expect } from "vitest";
import { RovingTabindexBrokenRule } from "@/rules/roving-tabindex-broken.js";
import {
  makeInteractiveElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

const reached = (selector: string) => ({
  selector,
  pageRect: { x: 0, y: 0, width: 10, height: 10 },
});

describe("RovingTabindexBrokenRule", () => {
  const rule = new RovingTabindexBrokenRule();

  it("should pass when there are no roving-tabindex groups", async () => {
    const result = await rule.evaluate(makeCrawlResult({}));

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should pass when every member of a group was reached via arrow keys", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "#tab-1" }),
          makeInteractiveElement({ selector: "#tab-2" }),
        ],
        rovingTabindexGroups: [
          {
            containerSelector: "#tablist",
            containerRole: "tablist",
            totalMembers: 2,
            reachedViaArrowKeys: [reached("#tab-1"), reached("#tab-2")],
            unreachedViaArrowKeys: [],
          },
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should flag members that could not be reached via arrow keys", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({
            selector: "#tab-2",
            outerHTML: '<button id="tab-2">Two</button>',
            accessibleName: "Two",
          }),
        ],
        rovingTabindexGroups: [
          {
            containerSelector: "#tablist",
            containerRole: "tablist",
            totalMembers: 2,
            reachedViaArrowKeys: [reached("#tab-1")],
            unreachedViaArrowKeys: ["#tab-2"],
          },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("warning");
    expect(result.violations[0].elements).toHaveLength(1);
    expect(result.violations[0].elements[0]).toMatchObject({
      selector: "#tab-2",
      outerHTML: '<button id="tab-2">Two</button>',
      accessibleName: "Two",
    });
  });

  it("should report one violation per broken group", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [],
        rovingTabindexGroups: [
          {
            containerSelector: "#tablist",
            containerRole: "tablist",
            totalMembers: 2,
            reachedViaArrowKeys: [reached("#tab-1")],
            unreachedViaArrowKeys: ["#tab-2"],
          },
          {
            containerSelector: "#menu",
            containerRole: "menu",
            totalMembers: 3,
            reachedViaArrowKeys: [reached("#item-1"), reached("#item-2")],
            unreachedViaArrowKeys: ["#item-3"],
          },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2);
  });
});
