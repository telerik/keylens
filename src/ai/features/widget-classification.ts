import type {
  InteractiveElement,
  WidgetClassification,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { throwIfAborted } from "../../utils/execution.js";
import { safeParseJSON, widgetClassificationBatchSchema } from "../schemas.js";
import { OUTER_HTML_LIMIT } from "../constants.js";
import type { AIFeatureContext } from "../provider.js";

/**
 * Classify interactive elements by WAI-ARIA APG pattern.
 * Identifies dialogs, menus, tabs, disclosures, etc. and returns
 * expected keyboard interactions for each.
 */
export async function classifyWidgets(
  ctx: AIFeatureContext,
  elements: InteractiveElement[],
): Promise<WidgetClassification[]> {
  logger.info("Running AI widget classification...");

  // Only classify elements with ARIA roles or complex patterns
  const candidates = elements.filter(
    (el) =>
      el.role &&
      el.role !== "generic" &&
      el.role !== "link" &&
      el.role !== "textbox" &&
      el.role !== "button",
  );

  if (candidates.length === 0) return [];

  const maxWidgets = ctx.config.limits?.maxWidgets ?? 20;
  const elementDescriptions = candidates
    .slice(0, maxWidgets) // Limit to avoid token overflow
    .map(
      (el, i) =>
        `${i + 1}. <${el.tagName}> role="${el.role}" name="${el.accessibleName}" HTML: ${el.outerHTML.slice(0, OUTER_HTML_LIMIT)}`,
    )
    .join("\n");

  const prompt = `You are a WAI-ARIA accessibility expert. Classify each element below by its APG (ARIA Authoring Practices Guide) widget pattern.

Elements:
${elementDescriptions}

For each element, respond with a JSON array. Each item must have:
- "index": the element number (1-based)
- "pattern": one of "dialog", "menu", "accordion", "tabs", "combobox", "disclosure", "tooltip", "unknown"
- "confidence": 0.0 to 1.0
- "expectedKeyboard": array of { "key": string, "expectedBehavior": string }

Only include elements you can classify with confidence >= 0.5.
Respond with ONLY the JSON array, no other text.`;

  try {
    const response = await ctx.provider.query(prompt);
    const parsed = safeParseJSON(response, widgetClassificationBatchSchema);

    if (!parsed) return [];

    return parsed
      .filter((item) => item.confidence >= 0.5)
      .map((item) => {
        const el = candidates[item.index - 1];
        if (!el) return null;
        return {
          element: {
            selector: el.selector,
            tagName: el.tagName,
            role: el.role,
            accessibleName: el.accessibleName,
            outerHTML: el.outerHTML,
          },
          pattern: item.pattern,
          confidence: item.confidence,
          expectedKeyboard: item.expectedKeyboard,
        } satisfies WidgetClassification;
      })
      .filter((c): c is WidgetClassification => c !== null);
  } catch (error) {
    throwIfAborted(ctx.signal, "ai");
    logger.debug(
      `AI widget classification failed: ${(error as Error).message}`,
    );
    return [];
  }
}
