import type {
  AuditReport,
  MultiPageReport,
  CrossPagePattern,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { throwIfAborted } from "../../utils/execution.js";
import { AIError } from "../../errors.js";
import { safeParseJSON, crossPagePatternBatchSchema } from "../schemas.js";
import type { AIFeatureContext } from "../provider.js";

/**
 * Detect inconsistent keyboard navigation patterns across multiple pages.
 * Uses heuristic pre-filtering to minimize AI calls.
 * Only invokes AI when heuristics find potential issues.
 */
export async function detectCrossPagePatterns(
  ctx: AIFeatureContext,
  report: MultiPageReport,
): Promise<CrossPagePattern[]> {
  if (report.pages.length < 2) return [];

  logger.info("Detecting cross-page keyboard patterns...");

  // Heuristic 1: shared selectors with different tab positions
  const sharedSelectors = findSharedSelectors(report.pages);

  // Heuristic 2: skip link inconsistencies
  const skipLinkIssues = findSkipLinkInconsistencies(report.pages);

  // If no heuristic findings, skip AI call entirely
  if (sharedSelectors.length === 0 && skipLinkIssues.length === 0) {
    logger.info("No cross-page inconsistencies detected by heuristics");
    return [];
  }

  // Build description of heuristic findings for AI enrichment
  const heuristicFindings: string[] = [];

  const maxElements = ctx.config.limits?.maxElements ?? 10;
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
    const response = await ctx.provider.query(prompt);
    const parsed = safeParseJSON(response, crossPagePatternBatchSchema);

    if (!parsed) throw new AIError("Invalid cross-page pattern response");

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
    throwIfAborted(ctx.signal, "ai");
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
        suggestion: "Ensure skip links are present and functional on all pages",
      });
    }
  }

  return patterns;
}

/**
 * Heuristic: find selectors that appear across multiple pages but at
 * different tab positions. Suggests inconsistent keyboard ordering.
 */
function findSharedSelectors(pages: AuditReport[]): Array<{
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
function findSkipLinkInconsistencies(pages: AuditReport[]): Array<{
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
