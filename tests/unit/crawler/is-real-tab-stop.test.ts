import { describe, it, expect } from "vitest";
import { isRealTabStop } from "@/crawler/index.js";

describe("isRealTabStop", () => {
  it("should return false for tabindex=-1 (explicit roving-tabindex member)", () => {
    expect(isRealTabStop(-1)).toBe(false);
  });

  it("should return false for null (attribute absent entirely)", () => {
    // A missing tabindex attribute is not a real tab stop - it must not be
    // treated the same as a genuine non-negative tabindex, or code that
    // force-focuses "the first member that isn't -1" ends up trying to
    // focus a non-focusable element (see container-retains-focus widgets
    // like a Kendo Calendar's day cells or PanelBar tree items).
    expect(isRealTabStop(null)).toBe(false);
  });

  it("should return true for tabindex=0", () => {
    expect(isRealTabStop(0)).toBe(true);
  });

  it("should return true for a positive tabindex", () => {
    expect(isRealTabStop(3)).toBe(true);
  });
});
