import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import { hasVisiblePixelDiff } from "@/utils/pixel-diff.js";

function makeSolidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = rgba[0];
    png.data[i * 4 + 1] = rgba[1];
    png.data[i * 4 + 2] = rgba[2];
    png.data[i * 4 + 3] = rgba[3];
  }
  return PNG.sync.write(png);
}

describe("hasVisiblePixelDiff", () => {
  it("returns false for two identical images", () => {
    const a = makeSolidPng(20, 20, [255, 255, 255, 255]);
    const b = makeSolidPng(20, 20, [255, 255, 255, 255]);
    expect(hasVisiblePixelDiff(a, b)).toBe(false);
  });

  it("returns true when a large solid-color region changes (e.g. a real focus ring)", () => {
    const a = makeSolidPng(20, 20, [255, 255, 255, 255]);
    const b = makeSolidPng(20, 20, [0, 100, 255, 255]);
    expect(hasVisiblePixelDiff(a, b)).toBe(true);
  });

  it("returns true when dimensions differ, since the images can't be compared reliably", () => {
    const a = makeSolidPng(20, 20, [255, 255, 255, 255]);
    const b = makeSolidPng(30, 20, [255, 255, 255, 255]);
    expect(hasVisiblePixelDiff(a, b)).toBe(true);
  });

  it("ignores a single differing pixel as noise", () => {
    const png = new PNG({ width: 20, height: 20 });
    for (let i = 0; i < 20 * 20; i++) {
      png.data[i * 4] = 255;
      png.data[i * 4 + 1] = 255;
      png.data[i * 4 + 2] = 255;
      png.data[i * 4 + 3] = 255;
    }
    const a = PNG.sync.write(png);
    // Flip a single pixel far from the noise floor threshold.
    png.data[0] = 0;
    png.data[1] = 0;
    png.data[2] = 0;
    const b = PNG.sync.write(png);
    expect(hasVisiblePixelDiff(a, b)).toBe(false);
  });
});
