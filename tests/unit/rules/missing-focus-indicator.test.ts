import { describe, it, expect } from "vitest";
import {
  MissingFocusIndicatorRule,
  hasVisibleFocusChange,
} from "@/rules/missing-focus-indicator.js";
import { classifyFocusChange } from "@/utils/focus-style-diff.js";
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
              ancestors: [{ "box-shadow": "0 0 0 2px blue" }],
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should detect an indicator applied to a :focus-within ancestor several levels up (not just the immediate parent)", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              ancestors: [{}, {}, { "box-shadow": "0 0 0 2px blue" }],
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot({
              ancestors: [{}, {}, {}],
            }),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should detect an indicator applied to a descendant (e.g. a switch's inner track), not just self/ancestors", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              descendants: [{ "outline-style": "solid" }],
            }),
            unfocusedStyleSnapshot: makeFocusStyleSnapshot({
              descendants: [{}],
            }),
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
  });

  it("should treat a pixel-confirmed indicator as passing even when no style diff was found", async () => {
    const el = makeFocusedElement({
      focusedStyleSnapshot: makeFocusStyleSnapshot(),
      unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
      focusIndicatorPixelConfirmed: true,
    });

    const result = await rule.evaluate(
      makeCrawlResult({ focusSequence: [el] }),
    );

    expect(result.passed).toBe(true);
    expect(el.hasFocusIndicator).toBe(true);
  });

  it("should still fail when the pixel confirmation also found no visible change", async () => {
    const el = makeFocusedElement({
      focusedStyleSnapshot: makeFocusStyleSnapshot(),
      unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
      focusIndicatorPixelConfirmed: false,
    });

    const result = await rule.evaluate(
      makeCrawlResult({ focusSequence: [el] }),
    );

    expect(result.passed).toBe(false);
    expect(el.hasFocusIndicator).toBe(false);
  });

  it("should detect a ::before pseudo-element indicator via a non-curated property", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            focusedStyleSnapshot: makeFocusStyleSnapshot({
              before: {
                content: '""',
                "background-color": "rgb(0, 100, 255)",
              },
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
        self: {
          "outline-style": "solid",
          "outline-width": "2px",
          "outline-offset": "2px",
        },
      });
      const unfocused = makeFocusStyleSnapshot({
        self: {
          "outline-style": "solid",
          "outline-width": "2px",
          "outline-offset": "0px",
        },
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

    it("returns true when a non-immediate ancestor's style differs (deep :focus-within wrapper)", () => {
      const focused = makeFocusStyleSnapshot({
        ancestors: [{}, { "outline-style": "solid" }],
      });
      const unfocused = makeFocusStyleSnapshot({
        ancestors: [{}, {}],
      });
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(true);
    });

    it("returns false when ancestor chains are the same length and nothing actually changed", () => {
      const focused = makeFocusStyleSnapshot({ ancestors: [{}, {}] });
      const unfocused = makeFocusStyleSnapshot({ ancestors: [{}, {}] });
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(false);
    });

    it("returns true when a descendant's style differs (indicator painted on an inner child, e.g. a switch track)", () => {
      const focused = makeFocusStyleSnapshot({
        descendants: [{}, { "outline-style": "solid" }],
      });
      const unfocused = makeFocusStyleSnapshot({
        descendants: [{}, {}],
      });
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(true);
    });

    it("returns false when descendant chains are the same length and nothing actually changed", () => {
      const focused = makeFocusStyleSnapshot({ descendants: [{}, {}] });
      const unfocused = makeFocusStyleSnapshot({ descendants: [{}, {}] });
      expect(hasVisibleFocusChange(focused, unfocused)).toBe(false);
    });
  });

  describe("classifyFocusChange (visual-property filter)", () => {
    const none = makeFocusStyleSnapshot();
    const classify = (focused: Parameters<typeof makeFocusStyleSnapshot>[0]) =>
      classifyFocusChange(makeFocusStyleSnapshot(focused), none);

    it("ignores cursor changes", () => {
      expect(classify({ self: { cursor: "help" } })).toBe("none");
    });

    it("ignores custom property changes", () => {
      expect(classify({ self: { "--ring": "1" } })).toBe("none");
    });

    it("ignores a fully transparent outline", () => {
      expect(
        classify({
          self: {
            "outline-style": "solid",
            "outline-width": "3px",
            "outline-color": "rgba(0, 0, 0, 0)",
          },
        }),
      ).toBe("none");
    });

    it("ignores a fully transparent box-shadow", () => {
      expect(
        classify({
          self: { "box-shadow": "rgba(0, 0, 0, 0) 0px 0px 0px 3px" },
        }),
      ).toBe("none");
    });

    it("ignores ::before changes when the pseudo-element has no content", () => {
      expect(
        classify({
          before: {
            content: "none",
            "border-top-style": "solid",
            "border-top-width": "4px",
          },
        }),
      ).toBe("none");
    });

    it("ignores changes on a descendant that is display:none in both states", () => {
      const hidden = { display: "none" };
      expect(
        classifyFocusChange(
          makeFocusStyleSnapshot({
            descendants: [{ ...hidden, color: "rgb(255, 0, 0)" }],
          }),
          makeFocusStyleSnapshot({ descendants: [hidden] }),
        ),
      ).toBe("none");
    });

    it("ignores changes on an element running the same animation in both states", () => {
      const anim = { "animation-name": "pulse" };
      expect(
        classifyFocusChange(
          makeFocusStyleSnapshot({
            self: { ...anim, "background-color": "rgb(156, 205, 254)" },
          }),
          makeFocusStyleSnapshot({
            self: { ...anim, "background-color": "rgb(238, 238, 238)" },
          }),
        ),
      ).toBe("none");
    });

    it("classifies an outline-only change as weak", () => {
      expect(
        classify({
          self: {
            "outline-style": "solid",
            "outline-width": "2px",
            "outline-color": "rgb(255, 0, 0)",
          },
        }),
      ).toBe("weak");
    });

    it("classifies a box-shadow-only change as weak", () => {
      expect(
        classify({ self: { "box-shadow": "rgb(0, 0, 255) 0px 0px 0px 2px" } }),
      ).toBe("weak");
    });

    it("classifies a border, background or color change as strong", () => {
      expect(classify({ self: { color: "rgb(255, 0, 0)" } })).toBe("strong");
      expect(classify({ self: { "background-color": "rgb(0, 0, 255)" } })).toBe(
        "strong",
      );
    });

    it("is strong when an outline change is accompanied by an inner change", () => {
      expect(
        classify({
          self: {
            "outline-style": "solid",
            "outline-width": "2px",
            "outline-color": "rgb(255, 0, 0)",
            "background-color": "rgb(0, 0, 255)",
          },
        }),
      ).toBe("strong");
    });
  });

  describe("weak changes and screenshot confirmation", () => {
    const weakFocused = makeFocusStyleSnapshot({
      self: {
        "outline-style": "solid",
        "outline-width": "2px",
        "outline-color": "rgb(255, 0, 0)",
      },
    });
    const run = (confirmed?: boolean) =>
      rule.evaluate(
        makeCrawlResult({
          focusSequence: [
            makeFocusedElement({
              focusedStyleSnapshot: weakFocused,
              unfocusedStyleSnapshot: makeFocusStyleSnapshot(),
              focusIndicatorPixelConfirmed: confirmed,
            }),
          ],
        }),
      );

    it("fails when the screenshot pass saw no pixel change (e.g. clipped outline)", async () => {
      expect((await run(false)).passed).toBe(false);
    });

    it("passes when the screenshot pass confirmed it", async () => {
      expect((await run(true)).passed).toBe(true);
    });

    it("trusts the style diff when the screenshot pass did not run", async () => {
      expect((await run(undefined)).passed).toBe(true);
    });
  });
});
