import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import { annotateFocusOrder } from "@/utils/screenshot-annotator.js";
import { makeFocusedElement } from "@tests/helpers/factories.js";

/** Create a minimal valid PNG as base64. */
function createTestPNG(width = 100, height = 100): string {
  const png = new PNG({ width, height });
  // Fill with white pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = 255;
      png.data[idx + 1] = 255;
      png.data[idx + 2] = 255;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png).toString("base64");
}

describe("annotateFocusOrder", () => {
  it("should return a valid base64 PNG", () => {
    const screenshot = createTestPNG();
    const elements = [
      makeFocusedElement({
        boundingRect: { x: 10, y: 10, width: 20, height: 20 },
      }),
    ];

    const result = annotateFocusOrder(screenshot, elements);

    // Should be valid base64
    expect(result.length).toBeGreaterThan(0);
    // Should be parseable as PNG
    const buffer = Buffer.from(result, "base64");
    const parsed = PNG.sync.read(buffer);
    expect(parsed.width).toBe(100);
    expect(parsed.height).toBe(100);
  });

  it("should produce a different image than the input", () => {
    const screenshot = createTestPNG();
    const elements = [
      makeFocusedElement({
        boundingRect: { x: 50, y: 50, width: 20, height: 20 },
      }),
    ];

    const result = annotateFocusOrder(screenshot, elements);

    // The annotated image should differ from the original
    expect(result).not.toBe(screenshot);
  });

  it("should handle multiple elements", () => {
    const screenshot = createTestPNG(200, 200);
    const elements = [
      makeFocusedElement({
        tabIndex: 1,
        boundingRect: { x: 10, y: 10, width: 20, height: 20 },
      }),
      makeFocusedElement({
        tabIndex: 2,
        boundingRect: { x: 80, y: 10, width: 20, height: 20 },
      }),
      makeFocusedElement({
        tabIndex: 3,
        boundingRect: { x: 10, y: 80, width: 20, height: 20 },
      }),
    ];

    const result = annotateFocusOrder(screenshot, elements);

    const buffer = Buffer.from(result, "base64");
    const parsed = PNG.sync.read(buffer);
    expect(parsed.width).toBe(200);
    expect(parsed.height).toBe(200);
  });

  it("should handle empty focus sequence", () => {
    const screenshot = createTestPNG();

    const result = annotateFocusOrder(screenshot, []);

    // Should return valid PNG unchanged (no markers to draw)
    const buffer = Buffer.from(result, "base64");
    const parsed = PNG.sync.read(buffer);
    expect(parsed.width).toBe(100);
    expect(parsed.height).toBe(100);
  });

  it("should use pageRect when available", () => {
    const screenshot = createTestPNG(200, 200);
    const elements = [
      makeFocusedElement({
        boundingRect: { x: 10, y: 10, width: 20, height: 20 },
        pageRect: { x: 50, y: 50, width: 20, height: 20 },
      }),
    ];

    const result = annotateFocusOrder(screenshot, elements);

    // Should produce valid output (pageRect preferred over boundingRect)
    const buffer = Buffer.from(result, "base64");
    const parsed = PNG.sync.read(buffer);
    expect(parsed.width).toBe(200);
  });

  it("should handle pageDimensions scaling", () => {
    // Image is 100x100 but page was 200x200 — coordinates should scale
    const screenshot = createTestPNG(100, 100);
    const elements = [
      makeFocusedElement({
        boundingRect: { x: 100, y: 100, width: 20, height: 20 },
      }),
    ];

    const result = annotateFocusOrder(screenshot, elements, {
      width: 200,
      height: 200,
    });

    const buffer = Buffer.from(result, "base64");
    const parsed = PNG.sync.read(buffer);
    expect(parsed.width).toBe(100);
  });

  it("should clamp markers to image bounds", () => {
    const screenshot = createTestPNG(50, 50);
    const elements = [
      makeFocusedElement({
        // Element near the edge — marker should be clamped
        boundingRect: { x: 0, y: 0, width: 5, height: 5 },
      }),
      makeFocusedElement({
        // Element beyond the edge
        boundingRect: { x: 45, y: 45, width: 10, height: 10 },
      }),
    ];

    // Should not throw
    const result = annotateFocusOrder(screenshot, elements);
    const buffer = Buffer.from(result, "base64");
    const parsed = PNG.sync.read(buffer);
    expect(parsed.width).toBe(50);
  });

  it("should handle double-digit numbers", () => {
    const screenshot = createTestPNG(400, 400);
    const elements = Array.from({ length: 12 }, (_, i) =>
      makeFocusedElement({
        tabIndex: i + 1,
        boundingRect: {
          x: (i % 4) * 100 + 20,
          y: Math.floor(i / 4) * 100 + 20,
          width: 30,
          height: 30,
        },
      }),
    );

    const result = annotateFocusOrder(screenshot, elements);

    const buffer = Buffer.from(result, "base64");
    const parsed = PNG.sync.read(buffer);
    expect(parsed.width).toBe(400);
  });
});
