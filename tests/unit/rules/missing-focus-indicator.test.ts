import { describe, it, expect } from "vitest";
import {
  MissingFocusIndicatorRule,
  hasVisibleFocusChange,
} from "@/rules/missing-focus-indicator.js";
import {
  makeFocusedElement,
  makeCrawlResult,
  makeFocusStyleSnapshot,
} from "@tests/helpers/factories.js";

describe("MissingFocusIndicatorRule", () => {
  const rule = new MissingFocusIndicatorRule();

  it("should pass when the element visibly changes on focus (outline)", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              self: { "outline-style": "solid", "outline-width": "2px" },
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when nothing visibly changes between focused and unfocused states", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            selector: "a.logo",
            focusedStyleSnapshot: makeFocusStyleSnapshot(),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("error");
    expect(result.violations[0].elements[0].selector).toBe("a.logo");
  });

  it("should detect a box-shadow-only indicator (outline suppressed)", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              self: {
                "box-shadow": "0 0 0 3px rgba(66, 153, 225, 0.5)",
              },
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should detect an indicator applied to a :focus-within parent container", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              parent: { "box-shadow": "0 0 0 2px blue" },
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should detect a ::before pseudo-element indicator via a non-curated property", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              before: { "background-color": "rgb(0, 100, 255)", width: "40px" },
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should skip elements without both snapshots and leave hasFocusIndicator null", async () => {
    const el = makeFocusedElement({ selector: "button.no-snapshot" });

    const result = await rule.evaluate(
      makeCrawlResult({ focusSequence: [el] }),
    );

    expect(result.passed).toBe(true);
    expect(el.hasFocusIndicator).toBeNull();
  });

  it("should fail only for elements without a visible change in a mixed set", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            selector: "a.clean",
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              self: { "outline-style": "solid", "outline-width": "2px" },
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
          makeFocusedElement({
            selector: "button.bad",
            focusedStyleSnapshot: makeFocusStyleSnapshot(),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations[0].elements).toHaveLength(1);
    expect(result.violations[0].elements[0].selector).toBe("button.bad");
  });

  it("should pass with empty focus sequence", async () => {
    const result = await rule.evaluate(makeCrawlResult({ focusSequence: [] }));

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should set hasFocusIndicator to true when a change is detected", async () => {
    const el = makeFocusedElement({
      focusedStyleSnapshot: makeFocusStyleSnapshot({
        self: { color: "rgb(255, 0, 0)" },
      }),
      unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
    });

    await rule.evaluate(makeCrawlResult({ focusSequence: [el] }));

    expect(el.hasFocusIndicator).toBe(true);
  });

  it("should set hasFocusIndicator to false when no change is detected", async () => {
    const el = makeFocusedElement({
      focusedStyleSnapshot: makeFocusStyleSnapshot(),
      unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
    });

    await rule.evaluate(makeCrawlResult({ focusSequence: [el] }));

    expect(el.hasFocusIndicator).toBe(false);
  });

  describe("hasVisibleFocusChange", () => {
    it("returns false for identical snapshots", () => {
      const snapshot = makeFocusStyleSnapshot();
      expect(hasVisibleFocusChange(snapshot, snapshot)).toBe(false);
    });

    it("returns true when any self property differs", () => {
      const focused = makeFocusStyleSnapshot({
        self: { filter: "drop-shadow(0 0 2px blue)" },
      });
      const unfocused = makeFocusStyleSnapshot();
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(true);
    });

    it("returns true when a property present only on one side differs", () => {
      const focused = makeFocusStyleSnapshot({
        self: { "letter-spacing": "1px" },
      });
      const unfocused = makeFocusStyleSnapshot();
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(true);
    });

    it("ignores outline-offset changing while outline-style stays none (regression: real-world false positive)", () => {
      const focused = makeFocusStyleSnapshot({
        self: { "outline-offset": "1px" },
      });
      const unfocused = makeFocusStyleSnapshot({
        self: { "outline-offset": "0px" },
      });
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(false);
    });

    it("still detects outline-offset changes once outline-style is actually rendered", () => {
      const focused = makeFocusStyleSnapshot({
        self: { "outline-style": "solid", "outline-offset": "2px" },
      });
      const unfocused = makeFocusStyleSnapshot({
        self: { "outline-style": "solid", "outline-offset": "0px" },
      });
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(true);
    });

    it("ignores border-top-color changing while border-top-width stays 0px", () => {
      const focused = makeFocusStyleSnapshot({
        self: { "border-top-color": "rgb(255, 0, 0)" },
      });
      const unfocused = makeFocusStyleSnapshot();
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(false);
    });

    it("ignores background-position changing while background-image stays none", () => {
      const focused = makeFocusStyleSnapshot({
        self: { "background-position": "10px 10px" },
      });
      const unfocused = makeFocusStyleSnapshot({
        self: { "background-position": "0px 0px" },
      });
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(false);
    });

    it("ignores animation-duration changing while animation-name stays none", () => {
      const focused = makeFocusStyleSnapshot({
        self: { "animation-duration": "0.3s" },
      });
      const unfocused = makeFocusStyleSnapshot();
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(false);
    });
  });
});
