import { describe, it, expect } from "vitest";
import { markReachedElements } from "@/crawler/index.js";
import {
  makeFocusedElement,
  makeInteractiveElement,
} from "@tests/helpers/factories.js";

describe("markReachedElements", () => {
  it("should mark elements with matching selectors as reached", () => {
    const interactiveElements = [
      makeInteractiveElement({ selector: "button.a", reached: false }),
      makeInteractiveElement({ selector: "button.b", reached: false }),
      makeInteractiveElement({ selector: "button.c", reached: false }),
    ];
    const focusSequence = [
      makeFocusedElement({ selector: "button.a" }),
      makeFocusedElement({ selector: "button.c" }),
    ];

    markReachedElements(interactiveElements, focusSequence);

    expect(interactiveElements[0].reached).toBe(true);
    expect(interactiveElements[1].reached).toBe(false);
    expect(interactiveElements[2].reached).toBe(true);
  });

  it("should leave all unreached when focus sequence is empty", () => {
    const interactiveElements = [
      makeInteractiveElement({ selector: "button.a", reached: false }),
      makeInteractiveElement({ selector: "button.b", reached: false }),
    ];

    markReachedElements(interactiveElements, []);

    expect(interactiveElements[0].reached).toBe(false);
    expect(interactiveElements[1].reached).toBe(false);
  });

  it("should handle empty interactive elements without error", () => {
    const focusSequence = [makeFocusedElement({ selector: "button.a" })];

    expect(() => markReachedElements([], focusSequence)).not.toThrow();
  });

  it("should mark all as reached when all selectors match", () => {
    const interactiveElements = [
      makeInteractiveElement({ selector: "button.a", reached: false }),
      makeInteractiveElement({ selector: "button.b", reached: false }),
    ];
    const focusSequence = [
      makeFocusedElement({ selector: "button.a" }),
      makeFocusedElement({ selector: "button.b" }),
    ];

    markReachedElements(interactiveElements, focusSequence);

    expect(interactiveElements.every((el) => el.reached)).toBe(true);
  });
});
