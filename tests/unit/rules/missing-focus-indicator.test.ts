import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import {
  MissingFocusIndicatorRule,
  compareScreenshots,
} from "@/rules/missing-focus-indicator.js";
import {
  makeFocusedElement,
  makeCrawlResult,
  makeInlineAsset,
} from "@tests/helpers/factories.js";

/** Create a solid-color PNG as base64. */
function makePng(
  width: number,
  height: number,
  color: [number, number, number, number],
): string {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
  return PNG.sync.write(png).toString("base64");
}

describe("MissingFocusIndicatorRule", () => {
  const rule = new MissingFocusIndicatorRule();

  it("should pass when no elements suppress focus outline", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            outerHTML: '<button class="btn">Click me</button>',
          }),
          makeFocusedElement({
            outerHTML: '<a href="/about">About</a>',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when outerHTML contains outline: none", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            selector: "a.logo",
            outerHTML:
              '<a class="logo" style="outline: none" href="/">Logo</a>',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("warning");
    expect(result.violations[0].elements[0].selector).toBe("a.logo");
  });

  it("should fail when outerHTML contains outline:0 (no space)", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            selector: "button.icon",
            outerHTML: '<button class="icon" style="outline:0">X</button>',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
  });

  it("should fail only for elements with outline suppression in a mixed set", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [
          makeFocusedElement({
            selector: "a.clean",
            outerHTML: '<a class="clean" href="/">Home</a>',
          }),
          makeFocusedElement({
            selector: "button.bad",
            outerHTML: '<button class="bad" style="outline: none">Bad</button>',
          }),
          makeFocusedElement({
            selector: "input.ok",
            outerHTML: '<input class="ok" type="text">',
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].elements).toHaveLength(1);
    expect(result.violations[0].elements[0].selector).toBe("button.bad");
  });

  it("should pass with empty focus sequence", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        focusSequence: [],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  describe("screenshot diffing", () => {
    const identicalPng = makePng(10, 10, [255, 255, 255, 255]);
    const differentPng = makePng(10, 10, [255, 0, 0, 255]);

    it("should detect identical screenshots as no focus indicator", async () => {
      const result = await rule.evaluate(
        makeCrawlResult({
          focusSequence: [
            makeFocusedElement({
              selector: "button.no-indicator",
              focusedScreenshotAssetId: "focused",
              unfocusedScreenshotAssetId: "unfocused",
            }),
          ],
          assets: [
            makeInlineAsset(
              "focused",
              identicalPng,
              "focused-element-screenshot",
            ),
            makeInlineAsset(
              "unfocused",
              identicalPng,
              "unfocused-element-screenshot",
            ),
          ],
        }),
      );

      expect(result.passed).toBe(false);
      const screenshotViolation = result.violations.find((v) =>
        v.message.includes("screenshot"),
      );
      expect(screenshotViolation).toBeDefined();
      expect(screenshotViolation!.severity).toBe("error");
    });

    it("should pass when screenshots differ (focus indicator present)", async () => {
      const result = await rule.evaluate(
        makeCrawlResult({
          focusSequence: [
            makeFocusedElement({
              selector: "button.has-indicator",
              focusedScreenshotAssetId: "focused",
              unfocusedScreenshotAssetId: "unfocused",
            }),
          ],
          assets: [
            makeInlineAsset(
              "focused",
              differentPng,
              "focused-element-screenshot",
            ),
            makeInlineAsset(
              "unfocused",
              identicalPng,
              "unfocused-element-screenshot",
            ),
          ],
        }),
      );

      // No screenshot-based violation
      const screenshotViolation = result.violations.find((v) =>
        v.message.includes("screenshot"),
      );
      expect(screenshotViolation).toBeUndefined();
    });

    it("should skip elements without screenshots", async () => {
      const result = await rule.evaluate(
        makeCrawlResult({
          focusSequence: [
            makeFocusedElement({
              selector: "button.no-screenshots",
              // no screenshot asset references
            }),
          ],
        }),
      );

      expect(result.passed).toBe(true);
    });

    it("should set hasFocusIndicator based on diff result", async () => {
      const el = makeFocusedElement({
        selector: "button.test",
        focusedScreenshotAssetId: "focused",
        unfocusedScreenshotAssetId: "unfocused",
      });

      await rule.evaluate(
        makeCrawlResult({
          focusSequence: [el],
          assets: [
            makeInlineAsset(
              "focused",
              differentPng,
              "focused-element-screenshot",
            ),
            makeInlineAsset(
              "unfocused",
              identicalPng,
              "unfocused-element-screenshot",
            ),
          ],
        }),
      );

      expect(el.hasFocusIndicator).toBe(true);
    });
  });

  describe("compareScreenshots", () => {
    it("should return 0 for identical images", async () => {
      const png = makePng(10, 10, [128, 128, 128, 255]);
      const ratio = await compareScreenshots(png, png);
      expect(ratio).toBe(0);
    });

    it("should return > 0 for different images", async () => {
      const a = makePng(10, 10, [255, 255, 255, 255]);
      const b = makePng(10, 10, [0, 0, 0, 255]);
      const ratio = await compareScreenshots(a, b);
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThan(0);
    });

    it("should return null for invalid base64", async () => {
      const ratio = await compareScreenshots("not-valid", "also-invalid");
      expect(ratio).toBeNull();
    });
  });
});
