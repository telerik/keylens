import { describe, it, expect } from "vitest";
import { SkipLinkRule } from "@/rules/skip-link.js";
import {
  makeFocusedElement,
  makeCrawlResult,
} from "@tests/helpers/factories.js";

describe("SkipLinkRule", () => {
  const rule = new SkipLinkRule();

  it("should pass when first element has skip link text", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.skip",
            accessibleName: "Skip to main content",
            outerHTML: '<a class="skip" href="#main">Skip to main content</a>',
          }),
          makeFocusedElement({ tabIndex: 2, selector: "a.nav-1" }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when no skip link is found in first 5 elements", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.logo",
            accessibleName: "Home",
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.nav-1",
            accessibleName: "Products",
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "a.nav-2",
            accessibleName: "About",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("warning");
  });

  it("should pass when skip link is at position 3 (within first 5)", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.logo",
            accessibleName: "Home",
          }),
          makeFocusedElement({
            tabIndex: 2,
            selector: "a.search",
            accessibleName: "Search",
          }),
          makeFocusedElement({
            tabIndex: 3,
            selector: "a.skip-nav",
            accessibleName: "Jump to content",
            outerHTML:
              '<a class="skip-nav" href="#content">Jump to content</a>',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should match skip link pattern in outerHTML", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.sr-only",
            accessibleName: "",
            outerHTML:
              '<a class="sr-only" href="#main">Skip to main content</a>',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should match pattern: skip.*nav", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.skip",
            accessibleName: "Skip navigation",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should match pattern: jump.*content", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.skip",
            accessibleName: "Jump to main content",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should match pattern: go.*to.*main", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.skip",
            accessibleName: "Go directly to main",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should match pattern: skip.*to", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            tabIndex: 1,
            selector: "a.skip",
            accessibleName: "Skip to",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  describe("with skipLinkResult from crawler", () => {
    it("should pass when skip link found and works", async () => {
      const result = await rule.evaluate(
        makeCrawlResult({
          focusSequence: [],
          skipLinkResult: {
            found: true,
            element: {
              selector: "a.skip",
              accessibleName: "Skip to main content",
              outerHTML: '<a href="#main">Skip to main content</a>',
            },
            functionWorks: true,
            focusTarget: "main",
          },
        }),
      );

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should fail with error when skip link found but does not work", async () => {
      const result = await rule.evaluate(
        makeCrawlResult({
          focusSequence: [],
          skipLinkResult: {
            found: true,
            element: {
              selector: "a.skip",
              accessibleName: "Skip to main content",
              outerHTML: '<a href="#nonexistent">Skip to main content</a>',
            },
            functionWorks: false,
          },
        }),
      );

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe("error");
      expect(result.violations[0].message).toContain("does not move focus");
    });

    it("should fail with warning when no skip link found", async () => {
      const result = await rule.evaluate(
        makeCrawlResult({
          focusSequence: [],
          skipLinkResult: {
            found: false,
            functionWorks: false,
          },
        }),
      );

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe("warning");
    });
  });

  it("should fail with empty focus sequence", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
  });
});
