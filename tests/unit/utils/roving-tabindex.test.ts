import { describe, it, expect } from "vitest";
import { getUnreachedInteractiveElements } from "@/utils/roving-tabindex.js";
import { makeInteractiveElement } from "@tests/helpers/factories.js";

describe("getUnreachedInteractiveElements", () => {
  it("excludes an orphan container's members when exactly one sibling container of the same role was reached", () => {
    // Mirrors a page that splits one flat keyboard domain across sibling ARIA
    // containers (e.g. one role="grid" per visual category): #group-a holds
    // the only Tab-reachable member, #group-b has none of its own.
    const result = getUnreachedInteractiveElements([
      makeInteractiveElement({
        selector: "#a1",
        role: "tab",
        reached: true,
        tabindexAttr: 0,
        rovingContainerSelector: "#group-a",
      }),
      makeInteractiveElement({
        selector: "#a2",
        role: "tab",
        reached: false,
        tabindexAttr: -1,
        rovingContainerSelector: "#group-a",
      }),
      makeInteractiveElement({
        selector: "#b1",
        role: "tab",
        reached: false,
        tabindexAttr: -1,
        rovingContainerSelector: "#group-b",
      }),
      makeInteractiveElement({
        selector: "#b2",
        role: "tab",
        reached: false,
        tabindexAttr: -1,
        rovingContainerSelector: "#group-b",
      }),
    ]);

    expect(result).toHaveLength(0);
  });

  it("does not merge when two containers of the same role are each independently reached", () => {
    // Two genuinely independent widgets - each already has its own active
    // member, so a third, truly broken orphan container should still be
    // flagged rather than silently absorbed into either host.
    const result = getUnreachedInteractiveElements([
      makeInteractiveElement({
        selector: "#a1",
        role: "tab",
        reached: true,
        tabindexAttr: 0,
        rovingContainerSelector: "#group-a",
      }),
      makeInteractiveElement({
        selector: "#b1",
        role: "tab",
        reached: true,
        tabindexAttr: 0,
        rovingContainerSelector: "#group-b",
      }),
      makeInteractiveElement({
        selector: "#c1",
        role: "tab",
        reached: false,
        tabindexAttr: -1,
        rovingContainerSelector: "#group-c",
      }),
    ]);

    expect(result.map((el) => el.selector)).toEqual(["#c1"]);
  });

  it("flags all members when no container of the shared role was ever reached", () => {
    // Nothing to merge into - a genuinely broken/unreachable widget must
    // still surface, not be silently ignored for lack of a verified entry point.
    const result = getUnreachedInteractiveElements([
      makeInteractiveElement({
        selector: "#a1",
        role: "tab",
        reached: false,
        tabindexAttr: -1,
        rovingContainerSelector: "#group-a",
      }),
      makeInteractiveElement({
        selector: "#b1",
        role: "tab",
        reached: false,
        tabindexAttr: -1,
        rovingContainerSelector: "#group-b",
      }),
    ]);

    expect(result.map((el) => el.selector)).toEqual(["#a1", "#b1"]);
  });

  it("does not merge containers of different member roles", () => {
    // A reached "tab" container must not accidentally vouch for an unreached
    // "gridcell" container just because both are unrelated composite widgets.
    const result = getUnreachedInteractiveElements([
      makeInteractiveElement({
        selector: "#tab-1",
        role: "tab",
        reached: true,
        tabindexAttr: 0,
        rovingContainerSelector: "#tablist",
      }),
      makeInteractiveElement({
        selector: "#cell-1",
        role: "gridcell",
        reached: false,
        tabindexAttr: -1,
        rovingContainerSelector: "#grid",
      }),
    ]);

    expect(result.map((el) => el.selector)).toEqual(["#cell-1"]);
  });
});
