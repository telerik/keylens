import type {
  InteractiveElement,
  AccessibleNameSuggestion,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { throwIfAborted } from "../../utils/execution.js";
import { safeParseJSON, accessibleNameBatchSchema } from "../schemas.js";
import { OUTER_HTML_LIMIT } from "../constants.js";
import type { AIFeatureContext } from "../provider.js";

/**
 * Infer accessible names for elements with empty or generic names.
 * Uses vision analysis when a page screenshot is available.
 */
export async function inferAccessibleNames(
  ctx: AIFeatureContext,
  interactiveElements: InteractiveElement[],
  pageScreenshot: string,
  pageDimensions?: { width: number; height: number },
): Promise<AccessibleNameSuggestion[]> {
  // Suppress unused parameter warning — pageDimensions reserved for future cropping
  void pageDimensions;

  logger.info("Running AI accessible name inference...");

  // Filter elements with empty or generic accessible names
  const genericNames = new Set(["", "button", "link", "input", "img"]);
  const candidates = interactiveElements.filter(
    (el) =>
      genericNames.has(el.accessibleName.toLowerCase().trim()) ||
      el.accessibleName.trim().length === 0,
  );

  if (candidates.length === 0) return [];

  const maxElements = ctx.config.limits?.maxElements ?? 10;
  const elementsToAnalyze = candidates.slice(0, maxElements);
  const elementDescriptions = elementsToAnalyze
    .map(
      (el, i) =>
        `${i + 1}. <${el.tagName}> role="${el.role}" name="${el.accessibleName || "(empty)"}" selector="${el.selector}" HTML: ${el.outerHTML.slice(0, OUTER_HTML_LIMIT)}`,
    )
    .join("\n");

  const prompt = `You are an accessibility expert. The following interactive elements have empty or generic accessible names.
Analyze each element's HTML context${pageScreenshot ? " and its position in the page screenshot" : ""} to suggest appropriate accessible labels.

Elements:
${elementDescriptions}

Respond with ONLY a JSON array. Each item must have:
- "index": the element number (1-based)
- "suggestedLabel": the suggested aria-label value
- "suggestedRole": optional corrected role (only if current role is wrong)
- "confidence": 0.0 to 1.0
- "reasoning": brief explanation of why this label is appropriate

Only include suggestions with confidence >= 0.5.`;

  try {
    let response: string;
    if (pageScreenshot && pageScreenshot.length > 100) {
      response = await ctx.provider.queryVision(prompt, [
        { base64: pageScreenshot, mediaType: "image/png" },
      ]);
    } else {
      response = await ctx.provider.query(prompt);
    }

    const parsed = safeParseJSON(response, accessibleNameBatchSchema);

    if (!parsed) return [];

    return parsed
      .filter((item) => item.confidence >= 0.5)
      .map((item): AccessibleNameSuggestion | null => {
        const el = elementsToAnalyze[item.index - 1];
        if (!el) return null;
        const suggestion: AccessibleNameSuggestion = {
          element: {
            selector: el.selector,
            tagName: el.tagName,
            role: el.role,
            outerHTML: el.outerHTML,
          },
          suggestedLabel: item.suggestedLabel,
          confidence: item.confidence,
          reasoning: item.reasoning,
        };
        if (item.suggestedRole) {
          suggestion.suggestedRole = item.suggestedRole;
        }
        return suggestion;
      })
      .filter((s): s is AccessibleNameSuggestion => s !== null);
  } catch (error) {
    throwIfAborted(ctx.signal, "ai");
    logger.debug(
      `AI accessible name inference failed: ${(error as Error).message}`,
    );
    return [];
  }
}
