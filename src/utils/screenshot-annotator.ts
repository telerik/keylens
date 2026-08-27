import { PNG } from "pngjs";
import type { FocusedElement } from "../types/index.js";

/** Marker radius in pixels. */
const MARKER_RADIUS = 14;

/** RGBA color for marker circles (sky blue). */
const MARKER_COLOR = { r: 56, g: 189, b: 248, a: 220 };

/** RGBA color for marker text background (dark). */
const MARKER_BG = { r: 15, g: 23, b: 42, a: 200 };

/**
 * Annotate a page screenshot with numbered circle markers at each
 * focused element's center position. Returns a new base64-encoded PNG.
 */
export function annotateFocusOrder(
  screenshotBase64: string,
  focusSequence: FocusedElement[],
  pageDimensions?: { width: number; height: number },
): string {
  const buffer = Buffer.from(screenshotBase64, "base64");
  const png = PNG.sync.read(buffer);

  for (let i = 0; i < focusSequence.length; i++) {
    const el = focusSequence[i];
    const rect = el.pageRect ?? el.boundingRect;

    // Calculate center position in image coordinates
    let cx = Math.round(rect.x + rect.width / 2);
    let cy = Math.round(rect.y + rect.height / 2);

    // If pageDimensions differ from image size, scale coordinates
    if (pageDimensions) {
      const scaleX = png.width / pageDimensions.width;
      const scaleY = png.height / pageDimensions.height;
      cx = Math.round(cx * scaleX);
      cy = Math.round(cy * scaleY);
    }

    // Clamp to image bounds
    cx = Math.max(MARKER_RADIUS, Math.min(png.width - MARKER_RADIUS - 1, cx));
    cy = Math.max(MARKER_RADIUS, Math.min(png.height - MARKER_RADIUS - 1, cy));

    drawCircleMarker(png, cx, cy, i + 1);
  }

  const outBuffer = PNG.sync.write(png);
  return outBuffer.toString("base64");
}

/**
 * Draw a filled circle with a number at the given position.
 */
function drawCircleMarker(png: PNG, cx: number, cy: number, num: number): void {
  const r = MARKER_RADIUS;

  // Draw filled circle background
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < png.width && py >= 0 && py < png.height) {
          setPixel(png, px, py, MARKER_BG);
        }
      }
    }
  }

  // Draw circle border (outer ring)
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= r - 2 && dist <= r) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < png.width && py >= 0 && py < png.height) {
          setPixel(png, px, py, MARKER_COLOR);
        }
      }
    }
  }

  // Draw number using simple bitmap font
  drawNumber(png, cx, cy, num);
}

/**
 * Set a pixel in the PNG with alpha blending.
 */
function setPixel(
  png: PNG,
  x: number,
  y: number,
  color: { r: number; g: number; b: number; a: number },
): void {
  const idx = (png.width * y + x) << 2;
  const alpha = color.a / 255;
  png.data[idx] = Math.round(png.data[idx] * (1 - alpha) + color.r * alpha);
  png.data[idx + 1] = Math.round(
    png.data[idx + 1] * (1 - alpha) + color.g * alpha,
  );
  png.data[idx + 2] = Math.round(
    png.data[idx + 2] * (1 - alpha) + color.b * alpha,
  );
  png.data[idx + 3] = 255;
}

/**
 * Draw a number centered at (cx, cy) using a simple 3x5 bitmap font.
 */
function drawNumber(png: PNG, cx: number, cy: number, num: number): void {
  const digits = num.toString();
  const digitWidth = 4; // 3px + 1px spacing
  const totalWidth = digits.length * digitWidth - 1;
  const startX = cx - Math.floor(totalWidth / 2);
  const startY = cy - 2; // 5px height, centered

  for (let d = 0; d < digits.length; d++) {
    const glyph = DIGIT_GLYPHS[digits[d] as keyof typeof DIGIT_GLYPHS];
    if (!glyph) continue;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row] & (1 << (2 - col))) {
          const px = startX + d * digitWidth + col;
          const py = startY + row;
          if (px >= 0 && px < png.width && py >= 0 && py < png.height) {
            setPixel(png, px, py, { r: 255, g: 255, b: 255, a: 255 });
          }
        }
      }
    }
  }
}

/**
 * 3x5 bitmap font for digits 0-9.
 * Each row is a 3-bit bitmask (MSB = left pixel).
 */
const DIGIT_GLYPHS: Record<string, number[]> = {
  "0": [0b111, 0b101, 0b101, 0b101, 0b111],
  "1": [0b010, 0b110, 0b010, 0b010, 0b111],
  "2": [0b111, 0b001, 0b111, 0b100, 0b111],
  "3": [0b111, 0b001, 0b111, 0b001, 0b111],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001],
  "5": [0b111, 0b100, 0b111, 0b001, 0b111],
  "6": [0b111, 0b100, 0b111, 0b101, 0b111],
  "7": [0b111, 0b001, 0b001, 0b001, 0b001],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111],
  "9": [0b111, 0b101, 0b111, 0b001, 0b111],
};
