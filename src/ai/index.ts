import type {
  AIConfig,
  AuditReport,
  MultiPageReport,
  RuleViolation,
  FocusedElement,
  InteractiveElement,
  WidgetClassification,
  AccessibleNameSuggestion,
  FocusIndicatorScore,
  AIFocusOrderResult,
  AIReportSummary,
  CrossPagePattern,
  AuditAsset,
} from "../types/index.js";
import { logger } from "../utils/logger.js";
import { getInlineAssetData } from "../utils/assets.js";
import { annotateFocusOrder } from "../utils/screenshot-annotator.js";
import { OpenAITransport } from "./openai-transport.js";
import { resolveAIAPIKey } from "../utils/config.js";
import { raceWithSignal, throwIfAborted } from "../utils/execution.js";
import {
  safeParseJSON,
  fixSuggestionBatchSchema,
  focusOrderResultSchema,
  reportSummarySchema,
  widgetClassificationBatchSchema,
  accessibleNameBatchSchema,
  focusIndicatorScoreBatchSchema,
  crossPagePatternBatchSchema,
} from "./schemas.js";

/** Max characters of outerHTML included in AI prompts to stay within token limits. */
const OUTER_HTML_LIMIT = 200;

/** Minimal type surface for the dynamically-imported Anthropic SDK client. */
interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicMessage {
  content: AnthropicContentBlock[];
}
interface AnthropicClient {
  messages: {
    create(
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<AnthropicMessage>;
  };
}

/**
 * AI-powered analysis layer for Keylens.
 * Provides intelligent focus order validation, fix suggestions,
 * widget classification, accessible name inference, and report summaries.
 *
 * Requires an API key for the configured provider.
 * The tool works fully without AI — these are enhancement features.
 */
export class AIAnalyzer {
  private config: AIConfig;
  private apiKey: string | null;
  private sdkAvailable: boolean | null = null;
  private anthropicClient: unknown = null;
  private openaiTransport: OpenAITransport | null = null;

  constructor(
    config: AIConfig,
    private signal?: AbortSignal,
  ) {
    this.config = config;

    this.apiKey = resolveAIAPIKey(config) ?? null;

    if (config.enabled && !this.apiKey && !config.transport) {
      const providerKeyHint =
        config.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
      logger.warn(
        `AI is enabled but no API key found. Set KEYLENS_AI_API_KEY or ${providerKeyHint} env var, or use ai.apiKey in config. AI features will be skipped.`,
      );
    }
  }

  /**
   * Check if the Anthropic SDK is installed. Result is cached.
   */
  private async checkSdkAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) return this.sdkAvailable;
    try {
      await import("@anthropic-ai/sdk");
      this.sdkAvailable = true;
    } catch {
      logger.warn(
        "AI features require @anthropic-ai/sdk. Install it with: npm install @anthropic-ai/sdk",
      );
      this.sdkAvailable = false;
    }
    return this.sdkAvailable;
  }

  /**
   * Check if AI analysis is available (enabled + has API key or transport).
   */
  isAvailable(): boolean {
    return (
      this.config.enabled && (this.apiKey !== null || !!this.config.transport)
    );
  }

  /**
   * Generate AI-powered fix suggestions for violations.
   * Batches all violations into a single AI call for performance.
   * Returns structured FixSuggestion when possible, falls back to string.
   */
  async generateFixSuggestions(violations: RuleViolation[]): Promise<void> {
    if (!this.isAvailable() || !this.config.features.fixSuggestions) return;
    if (violations.length === 0) return;

    logger.info("Generating AI fix suggestions...");

    // Batch violations into configurable chunks to stay within token limits
    const chunkSize = this.config.limits?.batchSize ?? 10;
    for (let i = 0; i < violations.length; i += chunkSize) {
      const chunk = violations.slice(i, i + chunkSize);
      try {
        const prompt = this.buildBatchFixSuggestionPrompt(chunk);
        const response = await this.query(prompt);

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
        throwIfAborted(this.signal, "ai");
        logger.debug(
          `AI batch fix suggestion failed: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Validate focus order using AI analysis.
   * When a page screenshot is available, uses vision-based analysis with
   * annotated markers for each focus position. Falls back to text-only.
   */
  async validateFocusOrder(
    focusSequence: FocusedElement[],
    pageScreenshot: string,
    pageDimensions?: { width: number; height: number },
  ): Promise<string | AIFocusOrderResult | null> {
    if (!this.isAvailable() || !this.config.features.focusOrderValidation) {
      return null;
    }

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

        const response = await this.queryVision(prompt, [
          { base64: annotatedScreenshot, mediaType: "image/png" },
        ]);

        const parsed = safeParseJSON(response, focusOrderResultSchema);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        throwIfAborted(this.signal, "ai");
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
      return await this.query(textPrompt);
    } catch (error) {
      throwIfAborted(this.signal, "ai");
      logger.debug(
        `AI focus order validation failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Generate an executive summary of the audit report.
   * Returns structured AIReportSummary when possible, falls back to string.
   */
  async generateSummary(
    report: AuditReport,
  ): Promise<string | AIReportSummary | null> {
    if (!this.isAvailable() || !this.config.features.reportSummary) {
      return null;
    }

    logger.info("Generating AI report summary...");

    const violationDetails = report.rules
      .filter((r) => r.status !== "error" && !r.passed)
      .flatMap((r) => r.violations)
      .map(
        (v) =>
          `- [${v.severity}] ${v.ruleName}: ${v.message} (${v.elements.length} element(s))`,
      )
      .join("\n");

    const prompt = `You are an accessibility consultant producing a structured summary of a keyboard navigation audit.

URL: ${report.url}
Focusable elements: ${report.crawl.totalFocusableElements}
Interactive elements: ${report.crawl.totalInteractiveElements}
Unreached elements: ${report.crawl.unreachedElements}
Tab cycle completed: ${report.crawl.cycleCompleted}
Errors: ${report.summary.totalErrors}
Warnings: ${report.summary.totalWarnings}
Rule evaluation errors: ${report.summary.errors ?? 0}
Score complete: ${report.summary.scoreComplete !== false}

Rule results:
${report.rules
  .map(
    (r) =>
      `- ${r.ruleId}: ${
        r.status === "error"
          ? `NOT EVALUATED (${r.error?.message ?? "evaluation error"})`
          : r.passed
            ? "PASSED"
            : `FAILED (${r.violations.length} issues)`
      }`,
  )
  .join("\n")}
${violationDetails ? `\nViolation details:\n${violationDetails}` : ""}

Respond with ONLY a JSON object matching this schema:
{
  "overview": "2-3 sentence overall assessment for non-technical stakeholders",
  "criticalIssues": ["most critical issue 1", "critical issue 2"],
  "prioritizedFixes": [
    { "fix": "what to do", "effort": "low"|"medium"|"high", "impact": "high"|"medium"|"low" }
  ],
  "aiSeverityRating": <1-100 integer>,
  "recommendation": "one-sentence next step recommendation"
}

Score guide: 90-100 excellent, 70-89 good, 50-69 needs work, below 50 critical issues.
If you cannot produce valid JSON, provide a concise 3-4 sentence summary as plain text.`;

    try {
      const response = await this.query(prompt);

      const parsed = safeParseJSON(response, reportSummarySchema);
      if (parsed) {
        return parsed;
      }

      return response;
    } catch (error) {
      throwIfAborted(this.signal, "ai");
      logger.debug(`AI summary generation failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Generate a cross-page executive summary for multi-page audits.
   * Aggregates per-page results and identifies cross-page themes.
   */
  async generateMultiPageSummary(
    report: MultiPageReport,
  ): Promise<string | AIReportSummary | null> {
    if (!this.isAvailable() || !this.config.features.reportSummary) {
      return null;
    }

    logger.info("Generating AI multi-page summary...");

    const pageOverviews = report.pages
      .map(
        (p) =>
          `- ${p.url}: ${p.summary.totalErrors} errors, ${p.summary.totalWarnings} warnings, ${p.crawl.totalFocusableElements} focusable elements`,
      )
      .join("\n");

    const crossPageIssues = report.crossPagePatterns
      ? report.crossPagePatterns
          .map((cp) => `- [${cp.type}] ${cp.description}`)
          .join("\n")
      : "";

    const prompt = `You are an accessibility consultant producing a structured summary of a multi-page keyboard navigation audit.

Pages audited: ${report.summary.totalPages}
Total errors: ${report.summary.totalErrors}
Total warnings: ${report.summary.totalWarnings}
Rule evaluation errors: ${report.summary.ruleErrors ?? 0}
Score complete: ${report.summary.scoreComplete !== false}
Pages with errors: ${report.summary.pagesWithErrors}

Per-page breakdown:
${pageOverviews}
${crossPageIssues ? `\nCross-page issues detected:\n${crossPageIssues}` : ""}

Respond with ONLY a JSON object matching this schema:
{
  "overview": "2-3 sentence overall assessment across all pages",
  "criticalIssues": ["site-wide critical issue 1", "critical issue 2"],
  "prioritizedFixes": [
    { "fix": "what to do site-wide", "effort": "low"|"medium"|"high", "impact": "high"|"medium"|"low" }
  ],
  "aiSeverityRating": <1-100 integer>,
  "recommendation": "one-sentence next step recommendation for the entire site"
}

Score guide: 90-100 excellent, 70-89 good, 50-69 needs work, below 50 critical issues.
If you cannot produce valid JSON, provide a concise 3-4 sentence summary as plain text.`;

    try {
      const response = await this.query(prompt);

      const parsed = safeParseJSON(response, reportSummarySchema);
      if (parsed) {
        return parsed;
      }

      return response;
    } catch (error) {
      throwIfAborted(this.signal, "ai");
      logger.debug(`AI multi-page summary failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Classify interactive elements by WAI-ARIA APG pattern.
   * Identifies dialogs, menus, tabs, disclosures, etc. and returns
   * expected keyboard interactions for each.
   */
  async classifyWidgets(
    elements: InteractiveElement[],
  ): Promise<WidgetClassification[]> {
    if (!this.isAvailable() || !this.config.features.widgetClassification) {
      return [];
    }

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

    const maxWidgets = this.config.limits?.maxWidgets ?? 20;
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
      const response = await this.query(prompt);
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
      throwIfAborted(this.signal, "ai");
      logger.debug(
        `AI widget classification failed: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Infer accessible names for elements with empty or generic names.
   * Uses vision analysis when a page screenshot is available.
   */
  async inferAccessibleNames(
    interactiveElements: InteractiveElement[],
    pageScreenshot: string,
    pageDimensions?: { width: number; height: number },
  ): Promise<AccessibleNameSuggestion[]> {
    if (!this.isAvailable() || !this.config.features.accessibleNameInference) {
      return [];
    }

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

    const maxElements = this.config.limits?.maxElements ?? 10;
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
        response = await this.queryVision(prompt, [
          { base64: pageScreenshot, mediaType: "image/png" },
        ]);
      } else {
        response = await this.query(prompt);
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
      throwIfAborted(this.signal, "ai");
      logger.debug(
        `AI accessible name inference failed: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Score the quality of focus indicators using vision analysis.
   * Batches multiple elements into a single vision call for performance.
   * Only scores elements with confirmed focus indicators and both screenshots.
   * Limited to 10 elements per audit.
   */
  async scoreFocusIndicatorQuality(
    focusSequence: FocusedElement[],
    assets: AuditAsset[],
  ): Promise<FocusIndicatorScore[]> {
    if (!this.isAvailable() || !this.config.features.focusIndicatorQuality) {
      return [];
    }

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

    const maxElements = this.config.limits?.maxElements ?? 10;
    const elementsToScore = candidates.slice(0, maxElements);

    // Batch all elements into a single vision call
    try {
      const elementDescriptions = elementsToScore
        .map(({ element: el }, i) => {
          const styleInfo = el.computedFocusStyles
            ? ` | Computed focus styles — outline: ${el.computedFocusStyles.outline}, box-shadow: ${el.computedFocusStyles.boxShadow}, border: ${el.computedFocusStyles.border}`
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
      const images: Array<{
        base64: string;
        mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
      }> = [];
      for (const candidate of elementsToScore) {
        images.push({ base64: candidate.focused, mediaType: "image/png" });
        images.push({
          base64: candidate.unfocused,
          mediaType: "image/png",
        });
      }

      const response = await this.queryVision(prompt, images);
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
      throwIfAborted(this.signal, "ai");
      logger.debug(
        `AI batch focus indicator scoring failed: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Detect inconsistent keyboard navigation patterns across multiple pages.
   * Uses heuristic pre-filtering to minimize AI calls.
   * Only invokes AI when heuristics find potential issues.
   */
  async detectCrossPagePatterns(
    report: MultiPageReport,
  ): Promise<CrossPagePattern[]> {
    if (!this.isAvailable() || !this.config.features.crossPagePatterns) {
      return [];
    }

    if (report.pages.length < 2) return [];

    logger.info("Detecting cross-page keyboard patterns...");

    // Heuristic 1: shared selectors with different tab positions
    const sharedSelectors = this.findSharedSelectors(report.pages);

    // Heuristic 2: skip link inconsistencies
    const skipLinkIssues = this.findSkipLinkInconsistencies(report.pages);

    // If no heuristic findings, skip AI call entirely
    if (sharedSelectors.length === 0 && skipLinkIssues.length === 0) {
      logger.info("No cross-page inconsistencies detected by heuristics");
      return [];
    }

    // Build description of heuristic findings for AI enrichment
    const heuristicFindings: string[] = [];

    const maxElements = this.config.limits?.maxElements ?? 10;
    for (const shared of sharedSelectors.slice(0, maxElements)) {
      const positionStr = Array.from(shared.positions.entries())
        .map(([url, pos]) => `${new URL(url).pathname}: #${pos}`)
        .join(", ");
      heuristicFindings.push(
        `Selector "${shared.selector}" appears at different tab positions: ${positionStr}`,
      );
    }

    for (const issue of skipLinkIssues) {
      if (issue.type === "missing") {
        heuristicFindings.push(
          `Skip link present on ${issue.pagesWithout.length} page(s) but missing from: ${issue.pagesWithIssue.join(", ")}`,
        );
      }
    }

    const patterns: CrossPagePattern[] = [];

    // Send to AI for enriched analysis
    const prompt = `You are a WCAG accessibility expert analyzing cross-page keyboard navigation consistency.

The following inconsistencies were detected across a multi-page audit:

${heuristicFindings.map((f, i) => `${i + 1}. ${f}`).join("\n")}

For each finding, classify it and provide a fix suggestion. Respond with ONLY a JSON array:
[
  {
    "findingIndex": 1,
    "type": "inconsistent-order" | "missing-component" | "inconsistent-focus-style" | "inconsistent-skip-link",
    "description": "clear description of the issue and its impact on users",
    "severity": "error" | "warning" | "info",
    "suggestion": "how to fix this cross-page inconsistency"
  }
]`;

    try {
      const response = await this.query(prompt);
      const parsed = safeParseJSON(response, crossPagePatternBatchSchema);

      if (!parsed) throw new Error("Invalid cross-page pattern response");

      for (const item of parsed) {
        // Determine affected pages from the original heuristic data
        let affectedPages: string[] = [];
        const idx = item.findingIndex - 1;

        if (idx < sharedSelectors.length) {
          affectedPages = Array.from(sharedSelectors[idx]!.positions.keys());
        } else {
          const skipIdx = idx - sharedSelectors.length;
          if (skipIdx < skipLinkIssues.length) {
            affectedPages = [
              ...skipLinkIssues[skipIdx]!.pagesWithIssue,
              ...skipLinkIssues[skipIdx]!.pagesWithout,
            ];
          }
        }

        patterns.push({
          type: item.type,
          description: item.description,
          affectedPages,
          severity: item.severity,
          suggestion: item.suggestion,
        });
      }
    } catch (error) {
      throwIfAborted(this.signal, "ai");
      logger.debug(
        `AI cross-page pattern detection failed: ${(error as Error).message}`,
      );

      // Fallback: create patterns from heuristic data alone (no AI)
      for (const shared of sharedSelectors) {
        patterns.push({
          type: "inconsistent-order",
          description: `Element "${shared.selector}" appears at different tab positions across pages`,
          affectedPages: Array.from(shared.positions.keys()),
          severity: "warning",
          suggestion:
            "Ensure shared components maintain consistent tab order across all pages",
        });
      }

      for (const issue of skipLinkIssues) {
        patterns.push({
          type: "inconsistent-skip-link",
          description: `Skip link inconsistency: ${issue.type} on ${issue.pagesWithIssue.length} page(s)`,
          affectedPages: [...issue.pagesWithIssue, ...issue.pagesWithout],
          severity: "warning",
          suggestion:
            "Ensure skip links are present and functional on all pages",
        });
      }
    }

    return patterns;
  }

  /**
   * Heuristic: find selectors that appear across multiple pages but at
   * different tab positions. Suggests inconsistent keyboard ordering.
   */
  private findSharedSelectors(pages: AuditReport[]): Array<{
    selector: string;
    positions: Map<string, number>;
  }> {
    const selectorMap = new Map<string, Map<string, number>>();

    for (const page of pages) {
      for (const el of page.focusSequence ?? []) {
        if (!selectorMap.has(el.selector)) {
          selectorMap.set(el.selector, new Map());
        }
        selectorMap.get(el.selector)!.set(page.url, el.tabIndex);
      }
    }

    const results: Array<{
      selector: string;
      positions: Map<string, number>;
    }> = [];

    for (const [selector, urlMap] of selectorMap) {
      if (urlMap.size < 2) continue;
      const positions = Array.from(urlMap.values());
      const allSame = positions.every((p) => p === positions[0]);
      if (!allSame) {
        results.push({ selector, positions: urlMap });
      }
    }

    return results;
  }

  /**
   * Heuristic: find skip link inconsistencies across pages.
   * Checks for skip link missing on some pages but present on others.
   */
  private findSkipLinkInconsistencies(pages: AuditReport[]): Array<{
    type: "missing" | "broken";
    pagesWithIssue: string[];
    pagesWithout: string[];
  }> {
    const results: Array<{
      type: "missing" | "broken";
      pagesWithIssue: string[];
      pagesWithout: string[];
    }> = [];

    const skipLinkResults = pages.map((page) => {
      const skipRule = page.rules.find((r) => r.ruleId === "skip-link");
      return {
        url: page.url,
        evaluated: skipRule?.status !== "error",
        passed: skipRule?.passed ?? true,
      };
    });

    const pagesWithSkipLink = skipLinkResults
      .filter((r) => r.evaluated && r.passed)
      .map((r) => r.url);
    const pagesMissingSkipLink = skipLinkResults
      .filter((r) => r.evaluated && !r.passed)
      .map((r) => r.url);

    if (pagesWithSkipLink.length > 0 && pagesMissingSkipLink.length > 0) {
      results.push({
        type: "missing",
        pagesWithIssue: pagesMissingSkipLink,
        pagesWithout: pagesWithSkipLink,
      });
    }

    return results;
  }

  /**
   * Build a batched prompt for generating fix suggestions for multiple violations.
   * Reduces N API calls to 1 for better performance, especially via MCP sampling.
   */
  private buildBatchFixSuggestionPrompt(violations: RuleViolation[]): string {
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

  /**
   * Send a text query to the configured AI provider.
   * Routes through injected transport (e.g. MCP sampling) when available
   * and no direct API key is set; otherwise uses the direct provider API.
   */
  private async query(prompt: string): Promise<string> {
    throwIfAborted(this.signal, "ai");
    let operation: Promise<string>;
    if (!this.apiKey && this.config.transport) {
      operation = this.config.transport.query(prompt, this.signal);
    } else if (this.config.provider === "openai") {
      operation = this.getOpenAITransport().query(prompt, this.signal);
    } else if (this.config.provider === "anthropic") {
      if (!(await this.checkSdkAvailable())) {
        throw new Error("@anthropic-ai/sdk is not installed");
      }
      operation = this.queryAnthropic(prompt);
    } else {
      throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
    return raceWithSignal(operation, this.signal, "ai");
  }

  /**
   * Send a vision query (text + images) to the configured AI provider.
   * Routes through injected transport when available and no direct API key is set.
   */
  private async queryVision(
    prompt: string,
    images: Array<{
      base64: string;
      mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    }>,
  ): Promise<string> {
    throwIfAborted(this.signal, "ai");
    let operation: Promise<string>;
    if (!this.apiKey && this.config.transport) {
      operation = this.config.transport.queryVision(
        prompt,
        images,
        this.signal,
      );
    } else if (this.config.provider === "openai") {
      operation = this.getOpenAITransport().queryVision(
        prompt,
        images,
        this.signal,
      );
    } else if (this.config.provider === "anthropic") {
      if (!(await this.checkSdkAvailable())) {
        throw new Error("@anthropic-ai/sdk is not installed");
      }
      operation = this.queryAnthropicVision(prompt, images);
    } else {
      throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
    return raceWithSignal(operation, this.signal, "ai");
  }

  /**
   * Get or create a cached OpenAI transport instance.
   */
  private getOpenAITransport(): OpenAITransport {
    if (!this.openaiTransport) {
      if (!this.apiKey) {
        throw new Error(
          "OpenAI provider requires an API key. Set KEYLENS_AI_API_KEY or OPENAI_API_KEY env var, or use ai.apiKey in config.",
        );
      }
      this.openaiTransport = new OpenAITransport(
        this.apiKey,
        this.config.model || "gpt-4o",
        this.config.baseURL,
      );
    }
    return this.openaiTransport;
  }

  /**
   * Query the Anthropic Claude API with text only.
   */
  private async queryAnthropic(prompt: string): Promise<string> {
    const client = (await this.getAnthropicClient()) as AnthropicClient;
    const params = {
      model: this.config.model || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    };
    const message: AnthropicMessage = this.signal
      ? await client.messages.create(params, { signal: this.signal })
      : await client.messages.create(params);

    const textBlock = message.content.find(
      (block: AnthropicContentBlock) => block.type === "text",
    );
    return textBlock?.text ?? "";
  }

  /**
   * Query the Anthropic Claude API with text + images (vision).
   */
  private async queryAnthropicVision(
    prompt: string,
    images: Array<{
      base64: string;
      mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    }>,
  ): Promise<string> {
    const content: Array<
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
            data: string;
          };
        }
      | { type: "text"; text: string }
    > = [];

    // Add images first, then the text prompt
    for (const img of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType,
          data: img.base64,
        },
      });
    }
    content.push({ type: "text", text: prompt });

    const client = (await this.getAnthropicClient()) as AnthropicClient;
    const params = {
      model: this.config.model || "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    };
    const message: AnthropicMessage = this.signal
      ? await client.messages.create(params, { signal: this.signal })
      : await client.messages.create(params);

    const textBlock = message.content.find(
      (block: AnthropicContentBlock) => block.type === "text",
    );
    return textBlock?.text ?? "";
  }

  /**
   * Get or create a cached Anthropic client instance.
   */
  private async getAnthropicClient(): Promise<unknown> {
    if (this.anthropicClient) return this.anthropicClient;
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    this.anthropicClient = new Anthropic({ apiKey: this.apiKey! });
    return this.anthropicClient;
  }
}
