import type {
  FocusedElement,
  AuditAsset,
  FocusIndicatorScore,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { throwIfAborted } from "../../utils/execution.js";
import { getInlineAssetData } from "../../utils/assets.js";
import { safeParseJSON, focusIndicatorScoreBatchSchema } from "../schemas.js";
import type { AIFeatureContext, AIVisionImage } from "../provider.js";

/**
 * Score the quality of focus indicators using vision analysis.
 * Batches multiple elements into a single vision call for performance.
 * Only scores elements with confirmed focus indicators and both screenshots.
 * Limited to `config.limits.maxElements` (default 10) per audit.
 */
export async function scoreFocusIndicatorQuality(
  ctx: AIFeatureContext,
  focusSequence: FocusedElement[],
  assets: AuditAsset[],
): Promise<FocusIndicatorScore[]> {
  logger.info("Running AI focus indicator quality scoring...");

  const candidates = focusSequence.flatMap((element) => {
    const focused = getInlineAssetData(
      assets,
      element.focusedScreenshotAssetId,
    );
    const unfocused = getInlineAssetData(
      assets,
      element.unfocusedScreenshotAssetId,
    );
    return focused && unfocused && element.hasFocusIndicator === true
      ? [{ element, focused, unfocused }]
      : [];
  });

  if (candidates.length === 0) return [];

  const maxElements = ctx.config.limits?.maxElements ?? 10;
  const elementsToScore = candidates.slice(0, maxElements);

  // Batch all elements into a single vision call
  try {
    const elementDescriptions = elementsToScore
      .map(({ element: el }, i) => {
        const self = el.focusedStyleSnapshot?.self;
        const styleInfo = self
          ? ` | Computed focus styles — outline: ${self.outline}, box-shadow: ${self["box-shadow"]}, border: ${self.border}`
          : "";
        return `Element ${i + 1}: <${el.tagName}> role="${el.role}" name="${el.accessibleName || "(none)"}"${styleInfo}`;
      })
      .join("\n");

    const prompt = `You are a WCAG accessibility expert evaluating the quality of keyboard focus indicators.

The images below show pairs of FOCUSED then UNFOCUSED states for each element, in order.
${elementsToScore.length > 1 ? `Images 1-2 are element 1 (focused, unfocused), images 3-4 are element 2, etc.` : "Image 1 is focused, image 2 is unfocused."}

Elements:
${elementDescriptions}

Evaluate each element's focus indicator and respond with ONLY a JSON array:
[
  {
    "elementIndex": 1,
    "score": <1-10 integer>,
    "contrast": "sufficient" | "low" | "very-low",
    "visibility": "clear" | "subtle" | "nearly-invisible",
    "recommendation": "improvement suggestion (omit if score >= 8)"
  }
]

Scoring guide:
- 9-10: High contrast, clearly visible indicator (thick outline, prominent glow, color change)
- 7-8: Adequate indicator, meets WCAG 2.4.7
- 5-6: Visible but subtle (thin outline, low contrast change)
- 3-4: Barely noticeable (very thin, low contrast)
- 1-2: Nearly invisible (barely any visual change)`;

    // Collect all screenshot pairs into a single images array
    const images: AIVisionImage[] = [];
    for (const candidate of elementsToScore) {
      images.push({ base64: candidate.focused, mediaType: "image/png" });
      images.push({
        base64: candidate.unfocused,
        mediaType: "image/png",
      });
    }

    const response = await ctx.provider.queryVision(prompt, images);
    const parsed = safeParseJSON(response, focusIndicatorScoreBatchSchema);

    if (!parsed) return [];

    const scores: FocusIndicatorScore[] = [];
    for (const item of parsed) {
      const candidate = elementsToScore[item.elementIndex - 1];
      if (candidate) {
        const el = candidate.element;
        const result: FocusIndicatorScore = {
          element: {
            selector: el.selector,
            tagName: el.tagName,
            role: el.role,
            accessibleName: el.accessibleName,
          },
          score: item.score,
          contrast: item.contrast,
          visibility: item.visibility,
        };
        if (item.recommendation) {
          result.recommendation = item.recommendation;
        }
        scores.push(result);
      }
    }

    return scores;
  } catch (error) {
    throwIfAborted(ctx.signal, "ai");
    logger.debug(
      `AI batch focus indicator scoring failed: ${(error as Error).message}`,
    );
    return [];
  }
}
