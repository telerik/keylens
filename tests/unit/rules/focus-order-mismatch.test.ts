import { describe, it, expect } from "vitest";
import { FocusOrderMismatchRule } from "@/rules/focus-order-mismatch.js";
import {
  makeFocusedElement,
  makeInteractiveElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

describe("FocusOrderMismatchRule", () => {
  const rule = new FocusOrderMismatchRule();

  it("should pass when focus order matches DOM order", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "a.nav" }),
          makeInteractiveElement({ selector: "a.nav-2" }),
          makeInteractiveElement({ selector: "button.main" }),
        ],
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.nav" }),
          makeFocusedElement({ tabIndex: 2, selector: "a.nav-2" }),
          makeFocusedElement({ tabIndex: 3, selector: "button.main" }),
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

  it("should pass when interactiveElements has no DOM-order reference for the focused elements", async () => {
    // No interactiveElements captured (or none matching) — nothing to compare against,
    // so the rule shouldn't guess and produce false positives.
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [],
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.one" }),
          makeFocusedElement({ tabIndex: 2, selector: "a.two" }),
          makeFocusedElement({ tabIndex: 3, selector: "a.three" }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail on the F44 example: tabindex reordering a natural content sequence", async () => {
    // WCAG F44-style example: a natural DOM sequence (Homepage, Chapter1..5)
    // gets its tab order reversed via tabindex, so tab order no longer
    // follows the DOM/content sequence.
    const chapters = [
      "a.chapter1",
      "a.chapter2",
      "a.chapter3",
      "a.chapter4",
      "a.chapter5",
    ];
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "a.homepage" }),
          ...chapters.map((selector) => makeInteractiveElement({ selector })),
        ],
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.homepage" }),
          ...[...chapters]
            .reverse()
            .map((selector, i) =>
              makeFocusedElement({ tabIndex: i + 2, selector }),
            ),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].severity).toBe("warning");
  });

  it("should not false-positive on a multi-column layout where one column is tabbed fully before another", async () => {
    // Per the WCAG 2.4.3 Understanding doc's own two-column example: a nav
    // sidebar can legitimately receive focus fully (in DOM order) before a
    // visually-adjacent, independent main-content column. This used to be
    // flagged as a "mismatch" by a pixel-position heuristic; DOM order shows
    // it's perfectly consistent.
    const sidenavItems = Array.from(
      { length: 20 },
      (_, i) => `a.sidenav-item-${i}`,
    );
    const mainItems = Array.from({ length: 5 }, (_, i) => `a.main-item-${i}`);
    const allSelectors = [...sidenavItems, ...mainItems];

    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: allSelectors.map((selector) =>
          makeInteractiveElement({ selector }),
        ),
        focusSequence: allSelectors.map((selector, i) =>
          makeFocusedElement({ tabIndex: i + 1, selector }),
        ),
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should not false-positive when live boundingRect/pageRect is skewed by scroll (DOM order ignores geometry entirely)", async () => {
    // Simulates a long scrollable sidenav where the browser auto-scrolls
    // (page-level or an internally-scrollable container) between tab stops,
    // so live rects jump around non-monotonically. Since the rule no longer
    // looks at geometry at all, this has no effect on the result.
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "a.item-1" }),
          makeInteractiveElement({ selector: "a.item-2" }),
          makeInteractiveElement({ selector: "a.item-3" }),
          makeInteractiveElement({ selector: "a.item-4" }),
          makeInteractiveElement({ selector: "a.item-5" }),
        ],
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.item-1",
            boundingRect: { x: 0, y: 700, width: 100, height: 40 },
            pageRect: { x: 0, y: 0, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.item-2",
            boundingRect: { x: 0, y: 50, width: 100, height: 40 },
            pageRect: { x: 0, y: 40, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "a.item-3",
            boundingRect: { x: 0, y: 700, width: 100, height: 40 },
            pageRect: { x: 0, y: 80, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 4,
            selector: "a.item-4",
            boundingRect: { x: 0, y: 50, width: 100, height: 40 },
            pageRect: { x: 0, y: 120, width: 100, height: 40 },
          }),
          makeFocusedElement({
            tabIndex: 5,
            selector: "a.item-5",
            boundingRect: { x: 0, y: 700, width: 100, height: 40 },
            pageRect: { x: 0, y: 160, width: 100, height: 40 },
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should tolerate minor deviations (position diff <= 3)", async () => {
    const selectors = ["a.first", "a.second", "a.third", "a.fourth"];
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: selectors.map((selector) =>
          makeInteractiveElement({ selector }),
        ),
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.first" }),
          // second/third swapped — a diff of 1, within tolerance
          makeFocusedElement({ tabIndex: 2, selector: "a.third" }),
          makeFocusedElement({ tabIndex: 3, selector: "a.second" }),
          makeFocusedElement({ tabIndex: 4, selector: "a.fourth" }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should only compare elements that have a DOM-order reference, ignoring dynamically-appeared ones", async () => {
    // "a.popup-item" isn't in interactiveElements (e.g. it only appeared after
    // an interaction, post-dating the discovery pass) — it should be excluded
    // from the comparison rather than treated as an unexplained mismatch.
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: [
          makeInteractiveElement({ selector: "a.one" }),
          makeInteractiveElement({ selector: "a.two" }),
          makeInteractiveElement({ selector: "a.three" }),
        ],
        focusSequence: [
          makeFocusedElement({ tabIndex: 1, selector: "a.one" }),
          makeFocusedElement({ tabIndex: 2, selector: "a.popup-item" }),
          makeFocusedElement({ tabIndex: 3, selector: "a.two" }),
          makeFocusedElement({ tabIndex: 4, selector: "a.three" }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should ignore repeated stops on the same element (keyboard trap)", async () => {
    const selectors = ["#a", "#b", "#c", "#d", "#e"];
    const result = await rule.evaluate(
      makeCrawlResult({
        interactiveElements: selectors.map((selector) =>
          makeInteractiveElement({ selector }),
        ),
        focusSequence: [
          ...Array.from({ length: 8 }, (_, i) =>
            makeFocusedElement({ tabIndex: i + 1, selector: "#a" }),
          ),
        ],
      }),
    );
    expect(result.passed).toBe(true);
  });
});
