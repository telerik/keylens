import type { RuleViolation } from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { throwIfAborted } from "../../utils/execution.js";
import { safeParseJSON, fixSuggestionBatchSchema } from "../schemas.js";
import { OUTER_HTML_LIMIT } from "../constants.js";
import type { AIFeatureContext } from "../provider.js";

/**
 * Generate AI-powered fix suggestions for violations.
 * Batches all violations into a single AI call per chunk for performance.
 * Mutates each violation's `fixSuggestion` in place; returns nothing.
 */
export async function generateFixSuggestions(
  ctx: AIFeatureContext,
  violations: RuleViolation[],
): Promise<void> {
  if (violations.length === 0) return;

  logger.info("Generating AI fix suggestions...");

  // Batch violations into configurable chunks to stay within token limits
  const chunkSize = ctx.config.limits?.batchSize ?? 10;
  for (let i = 0; i < violations.length; i += chunkSize) {
    const chunk = violations.slice(i, i + chunkSize);
    try {
      const prompt = buildBatchFixSuggestionPrompt(chunk);
      const response = await ctx.provider.query(prompt);

      // Try to parse batch response
      const parsed = safeParseJSON(response, fixSuggestionBatchSchema);
      if (parsed) {
        for (const item of parsed) {
          const idx = item.violationIndex - 1;
          const violation = chunk[idx];
          if (violation && item.summary && item.wcagRef && item.explanation) {
            const { violationIndex: _vi, ...suggestion } = item;
            void _vi;
            violation.fixSuggestion = suggestion;
          }
        }
        // Fill in any missing ones with a fallback
        for (const violation of chunk) {
          if (!violation.fixSuggestion) {
            logger.debug(
              `No structured fix in batch response for ${violation.ruleId}`,
            );
          }
        }
        continue;
      }

      // Fallback: assign entire response to first violation in chunk
      if (chunk.length === 1 && chunk[0]) {
        chunk[0].fixSuggestion = response;
      }
    } catch (error) {
      throwIfAborted(ctx.signal, "ai");
      logger.debug(
        `AI batch fix suggestion failed: ${(error as Error).message}`,
      );
    }
  }
}

/**
 * Build a batched prompt for generating fix suggestions for multiple violations.
 * Reduces N API calls to 1 for better performance, especially via MCP sampling.
 */
function buildBatchFixSuggestionPrompt(violations: RuleViolation[]): string {
  const violationDescriptions = violations
    .map((v, i) => {
      const elements = v.elements
        .slice(0, 2)
        .map(
          (el) =>
            `    Selector: ${el.selector}\n    HTML: ${el.outerHTML?.slice(0, OUTER_HTML_LIMIT)}`,
        )
        .join("\n\n");

      return `Violation ${i + 1}:
  Rule: ${v.ruleName} (WCAG ${v.wcag?.join(", ") || "N/A"})
  Issue: ${v.message}
  Impact: ${v.impact}
  Affected elements:
${elements}`;
    })
    .join("\n\n");

  return `You are a senior frontend developer specializing in web accessibility.

A keyboard navigation audit found the following ${violations.length} issue(s):

${violationDescriptions}

Respond with ONLY a JSON array. For each violation, include an object matching this schema:
[
  {
    "violationIndex": 1,
    "summary": "brief 1-sentence fix description",
    "codeBefore": "original code snippet (if applicable, otherwise omit)",
    "codeAfter": "fixed code snippet (if applicable, otherwise omit)",
    "wcagRef": "WCAG success criteria reference",
    "estimatedEffort": "low" | "medium" | "high",
    "explanation": "2-3 sentence explanation of why this fix works"
  }
]

Provide one entry per violation, using the violationIndex (1-based) to match them.`;
}
