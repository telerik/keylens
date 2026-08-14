import type { FocusedElement, AIFocusOrderResult } from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { throwIfAborted } from "../../utils/execution.js";
import { annotateFocusOrder } from "../../utils/screenshot-annotator.js";
import { safeParseJSON, focusOrderResultSchema } from "../schemas.js";
import type { AIFeatureContext } from "../provider.js";

/**
 * Validate focus order using AI analysis.
 * When a page screenshot is available, uses vision-based analysis with
 * annotated markers for each focus position. Falls back to text-only.
 */
export async function validateFocusOrder(
  ctx: AIFeatureContext,
  focusSequence: FocusedElement[],
  pageScreenshot: string,
  pageDimensions?: { width: number; height: number },
): Promise<string | AIFocusOrderResult | null> {
  logger.info("Running AI focus order validation...");

  const sequenceText = focusSequence
    .map(
      (el, i) =>
        `${i + 1}. <${el.tagName}> role="${el.role}" name="${el.accessibleName}" at position (${Math.round(el.boundingRect.x)}, ${Math.round(el.boundingRect.y)})`,
    )
    .join("\n");

  // Try vision-based analysis if screenshot is available
  if (pageScreenshot && pageScreenshot.length > 100) {
    try {
      const annotatedScreenshot = annotateFocusOrder(
        pageScreenshot,
        focusSequence,
        pageDimensions,
      );

      const prompt = `You are an accessibility expert analyzing a web page's keyboard focus order.
The screenshot shows the page with numbered circle markers indicating the tab order.

Here is the focus sequence (matching the numbered markers):
${sequenceText}

Analyze the visual layout and focus order. Respond with ONLY a JSON object matching this schema:
{
  "summary": "brief overall assessment",
  "issues": [
    {
      "elementIndex": 1,
      "description": "what's wrong",
      "severity": "error" | "warning" | "info",
      "suggestion": "how to fix"
    }
  ],
  "overallAssessment": "good" | "acceptable" | "poor"
}

Only flag genuine issues where the focus order would confuse a keyboard user.
If the focus order is logical, return an empty issues array with "good" assessment.`;

      const response = await ctx.provider.queryVision(prompt, [
        { base64: annotatedScreenshot, mediaType: "image/png" },
      ]);

      const parsed = safeParseJSON(response, focusOrderResultSchema);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      throwIfAborted(ctx.signal, "ai");
      logger.debug(
        `Vision-based focus order validation failed, falling back to text: ${(error as Error).message}`,
      );
    }
  }

  // Fallback: text-only analysis
  const textPrompt = `You are an accessibility expert analyzing a web page's keyboard focus order.

Here is the focus sequence (in tab order):
${sequenceText}

Evaluate whether this focus order is logical given the element types, roles, and positions.
Flag any elements where the focus sequence would confuse a keyboard user.
Be concise. Only flag genuine issues, not minor nitpicks.`;

  try {
    return await ctx.provider.query(textPrompt);
  } catch (error) {
    throwIfAborted(ctx.signal, "ai");
    logger.debug(
      `AI focus order validation failed: ${(error as Error).message}`,
    );
    return null;
  }
}
