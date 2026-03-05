/**
 * Zod schemas for validating AI JSON responses.
 * Each schema matches the corresponding TypeScript interface in types/index.ts.
 * Used by AIAnalyzer to safely parse structured AI outputs instead of
 * raw `JSON.parse() as T` casts.
 */
import { z } from "zod";

// ─── Shared ──────────────────────────────────────────────────────

const severitySchema = z.enum(["error", "warning", "info"]);

// ─── Fix Suggestions ─────────────────────────────────────────────

export const fixSuggestionItemSchema = z.object({
  violationIndex: z.number(),
  summary: z.string(),
  codeBefore: z.string().optional(),
  codeAfter: z.string().optional(),
  wcagRef: z.string(),
  estimatedEffort: z.enum(["low", "medium", "high"]),
  explanation: z.string(),
});

export const fixSuggestionBatchSchema = z.array(fixSuggestionItemSchema);

// ─── Focus Order Result ──────────────────────────────────────────

export const focusOrderResultSchema = z.object({
  summary: z.string(),
  issues: z.array(
    z.object({
      elementIndex: z.number(),
      description: z.string(),
      severity: severitySchema,
      suggestion: z.string(),
    }),
  ),
  overallAssessment: z.enum(["good", "acceptable", "poor"]),
});

// ─── Report Summary ──────────────────────────────────────────────

export const reportSummarySchema = z.object({
  overview: z.string(),
  criticalIssues: z.array(z.string()),
  prioritizedFixes: z.array(
    z.object({
      fix: z.string(),
      effort: z.enum(["low", "medium", "high"]),
      impact: z.enum(["high", "medium", "low"]),
    }),
  ),
  aiSeverityRating: z.number().int().min(1).max(100),
  recommendation: z.string(),
});

// ─── Widget Classification ───────────────────────────────────────

export const widgetClassificationItemSchema = z.object({
  index: z.number(),
  pattern: z.enum([
    "dialog",
    "menu",
    "accordion",
    "tabs",
    "combobox",
    "disclosure",
    "tooltip",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  expectedKeyboard: z.array(
    z.object({
      key: z.string(),
      expectedBehavior: z.string(),
    }),
  ),
});

export const widgetClassificationBatchSchema = z.array(
  widgetClassificationItemSchema,
);

// ─── Accessible Name Inference ───────────────────────────────────

export const accessibleNameItemSchema = z.object({
  index: z.number(),
  suggestedLabel: z.string(),
  suggestedRole: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const accessibleNameBatchSchema = z.array(accessibleNameItemSchema);

// ─── Focus Indicator Quality ─────────────────────────────────────

export const focusIndicatorScoreItemSchema = z.object({
  elementIndex: z.number(),
  score: z.number().int().min(1).max(10),
  contrast: z.enum(["sufficient", "low", "very-low"]),
  visibility: z.enum(["clear", "subtle", "nearly-invisible"]),
  recommendation: z.string().optional(),
});

export const focusIndicatorScoreBatchSchema = z.array(
  focusIndicatorScoreItemSchema,
);

// ─── Cross-Page Patterns ─────────────────────────────────────────

export const crossPagePatternItemSchema = z.object({
  findingIndex: z.number(),
  type: z.enum([
    "inconsistent-order",
    "missing-component",
    "inconsistent-focus-style",
    "inconsistent-skip-link",
  ]),
  description: z.string(),
  severity: severitySchema,
  suggestion: z.string(),
});

export const crossPagePatternBatchSchema = z.array(crossPagePatternItemSchema);

// ─── Safe Parse Helper ───────────────────────────────────────────

/**
 * Safely parse a JSON string and validate it against a Zod schema.
 * Returns `null` if the string is not valid JSON or doesn't match the schema.
 */
export function safeParseJSON<T>(raw: string, schema: z.ZodType<T>): T | null {
  try {
    const data: unknown = JSON.parse(raw);
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
