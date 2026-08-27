import { describe, it, expect } from "vitest";
import {
  getRovingArrowKeys,
  getFallbackArrowKeys,
} from "@/utils/aria-orientation.js";

describe("getRovingArrowKeys", () => {
  it("defaults tablist to horizontal (Left/Right)", () => {
    expect(getRovingArrowKeys("tablist", null)).toEqual({
      forward: ["ArrowRight"],
      backward: ["ArrowLeft"],
    });
  });

  it("defaults listbox, menu, tree to vertical (Up/Down)", () => {
    for (const role of ["listbox", "menu", "tree"]) {
      expect(getRovingArrowKeys(role, null)).toEqual({
        forward: ["ArrowDown"],
        backward: ["ArrowUp"],
      });
    }
  });

  it("defaults toolbar and menubar to horizontal", () => {
    for (const role of ["toolbar", "menubar"]) {
      expect(getRovingArrowKeys(role, null)).toEqual({
        forward: ["ArrowRight"],
        backward: ["ArrowLeft"],
      });
    }
  });

  it("honors an explicit aria-orientation override", () => {
    expect(getRovingArrowKeys("tablist", "vertical")).toEqual({
      forward: ["ArrowDown"],
      backward: ["ArrowUp"],
    });
    expect(getRovingArrowKeys("listbox", "horizontal")).toEqual({
      forward: ["ArrowRight"],
      backward: ["ArrowLeft"],
    });
  });

  it("allows all four arrow keys for radiogroup regardless of orientation", () => {
    expect(getRovingArrowKeys("radiogroup", null)).toEqual({
      forward: ["ArrowRight", "ArrowDown"],
      backward: ["ArrowLeft", "ArrowUp"],
    });
  });

  it("tries both axes for grid and treegrid (2D navigation)", () => {
    for (const role of ["grid", "treegrid"]) {
      expect(getRovingArrowKeys(role, null)).toEqual({
        forward: ["ArrowDown", "ArrowRight"],
        backward: ["ArrowUp", "ArrowLeft"],
      });
    }
  });

  it("falls back to vertical for unrecognized roles", () => {
    expect(getRovingArrowKeys("unknown-role", null)).toEqual({
      forward: ["ArrowDown"],
      backward: ["ArrowUp"],
    });
  });
});

describe("getFallbackArrowKeys", () => {
  it("returns the orthogonal axis keys not already tried", () => {
    const primary = { forward: ["ArrowRight"], backward: ["ArrowLeft"] };
    expect(getFallbackArrowKeys(primary)).toEqual({
      forward: ["ArrowDown"],
      backward: ["ArrowUp"],
    });
  });

  it("returns nothing extra when all four keys were already tried", () => {
    const primary = {
      forward: ["ArrowRight", "ArrowDown"],
      backward: ["ArrowLeft", "ArrowUp"],
    };
    expect(getFallbackArrowKeys(primary)).toEqual({
      forward: [],
      backward: [],
    });
  });
});
