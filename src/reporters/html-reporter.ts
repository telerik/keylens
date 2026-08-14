import type {
  AuditReport,
  FocusedElement,
  MultiPageReport,
  WidgetClassification,
  AIFocusOrderResult,
  FixSuggestion,
  AccessibleNameSuggestion,
  FocusIndicatorScore,
  AIReportSummary,
  CrossPagePattern,
} from "../types/index.js";
import { writeReportFile } from "../utils/report-writer.js";
import { getInlineAssetData } from "../utils/assets.js";

/**
 * Output an interactive HTML report with a visual focus order map.
 */
export async function reportHTML(
  report: AuditReport,
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  await writeReportFile(
    outputDir,
    "keylens-report.html",
    renderHTML(report),
    "HTML",
    signal,
    report.url,
  );
}

/**
 * Output a multi-page HTML report with tabbed per-page sections.
 */
export async function reportMultiHTML(
  report: MultiPageReport,
  outputDir: string,
  signal?: AbortSignal,
): Promise<void> {
  await writeReportFile(
    outputDir,
    "keylens-report.html",
    renderMultiHTML(report),
    "HTML",
    signal,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStatusColor(errors: number, warnings: number): string {
  if (errors > 0) return "#ef4444";
  if (warnings > 0) return "#f59e0b";
  return "#22c55e";
}

function pageScreenshotForMap(report: AuditReport): string {
  if (report.config.capture?.page === "viewport") {
    return "";
  }
  return getInlineAssetData(report.assets, report.pageScreenshotAssetId) ?? "";
}

// ─── Focus Map ────────────────────────────────────────────────────

/**
 * Build HTML for the focus map overlay: page screenshot as background
 * with numbered circle markers at each focused element position and
 * SVG connecting lines between consecutive markers.
 */
export function buildFocusMapHTML(
  focusSequence: FocusedElement[],
  pageScreenshot: string,
  pageDimensions?: { width: number; height: number },
  violationSelectors?: Set<string>,
): string {
  if (!focusSequence.length || !pageScreenshot) return "";

  const dims = pageDimensions ?? { width: 1280, height: 720 };

  const markers = focusSequence.map((el, i) => {
    const rect = el.pageRect ?? el.boundingRect;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const leftPct = (cx / dims.width) * 100;
    const topPct = (cy / dims.height) * 100;
    const hasViolation = violationSelectors?.has(el.selector) ?? false;
    const color = hasViolation ? "#ef4444" : "#38bdf8";
    const name = escapeHTML(el.accessibleName || el.tagName);
    const selector = escapeHTML(el.selector);

    return `<div class="focus-marker" style="left:${leftPct.toFixed(3)}%;top:${topPct.toFixed(3)}%;border-color:${color};color:${color};background:${color}22;" title="#${i + 1} ${name} — ${selector}" data-index="${i}">${i + 1}</div>`;
  });

  // SVG connecting lines
  const lines = focusSequence
    .slice(1)
    .map((el, i) => {
      const prev = focusSequence[i]!;
      const prevRect = prev.pageRect ?? prev.boundingRect;
      const curRect = el.pageRect ?? el.boundingRect;
      const x1 = ((prevRect.x + prevRect.width / 2) / dims.width) * 100;
      const y1 = ((prevRect.y + prevRect.height / 2) / dims.height) * 100;
      const x2 = ((curRect.x + curRect.width / 2) / dims.width) * 100;
      const y2 = ((curRect.y + curRect.height / 2) / dims.height) * 100;
      return `<line x1="${x1.toFixed(3)}%" y1="${y1.toFixed(3)}%" x2="${x2.toFixed(3)}%" y2="${y2.toFixed(3)}%" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6,4" stroke-opacity="0.5"/>`;
    })
    .join("\n        ");

  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Focus Order Map</h2>
    <div class="focus-map">
      <img src="data:image/png;base64,${pageScreenshot}" alt="Page screenshot">
      <svg class="focus-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        ${lines}
      </svg>
      ${markers.join("\n      ")}
    </div>`;
}

// ─── Single Page HTML ─────────────────────────────────────────────

export function renderHTML(input: AuditReport): string {
  const report = input;
  const { summary, rules, crawl, url } = report;
  const statusColor = buildStatusColor(
    summary.totalErrors,
    summary.totalWarnings,
  );

  // Collect selectors of elements with violations for focus map color-coding
  const violationSelectors = new Set<string>();
  for (const rule of rules) {
    for (const v of rule.violations) {
      for (const el of v.elements) {
        violationSelectors.add(el.selector);
      }
    }
  }

  const focusMap = buildFocusMapHTML(
    report.focusSequence ?? [],
    pageScreenshotForMap(report),
    report.pageDimensions,
    violationSelectors,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Keylens Report — ${escapeHTML(url)}</title>
  ${COMMON_STYLES(statusColor)}
</head>
<body>
  <div class="container">
    <header>
      <h1>Keylens Report <span>v${escapeHTML(report.version)}</span></h1>
      <p style="color: #94a3b8; margin-top: 0.5rem;">${escapeHTML(url)}</p>
      <p style="color: #64748b; font-size: 0.8rem;">${escapeHTML(report.timestamp)}</p>
    </header>

    ${buildMetaCards(crawl, summary)}
    ${buildPrepareNote(crawl)}

    ${focusMap}

    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Rules</h2>
    ${buildRulesHTML(rules)}

    ${report.aiFocusOrderAnalysis ? buildFocusOrderAnalysisHTML(report.aiFocusOrderAnalysis) : ""}

    ${buildWidgetClassificationsHTML(report.widgetClassifications)}

    ${buildAccessibleNameSuggestionsHTML(report.accessibleNameSuggestions)}

    ${buildFocusIndicatorScoresHTML(report.focusIndicatorScores)}

    ${report.aiSummary ? buildAISummaryHTML(report.aiSummary) : ""}

    <footer>
      Generated by Keylens v${escapeHTML(report.version)} &bull; ${escapeHTML(report.timestamp)}
    </footer>
  </div>
</body>
</html>`;
}

// ─── Multi-Page HTML ──────────────────────────────────────────────

export function renderMultiHTML(input: MultiPageReport): string {
  const report = input;
  const statusColor = buildStatusColor(
    report.summary.totalErrors,
    report.summary.totalWarnings,
  );

  const tabs = report.pages
    .map((page, i) => {
      let label: string;
      try {
        label = new URL(page.url).pathname || page.url;
      } catch {
        label = page.url;
      }
      return `<button class="tab-btn${i === 0 ? " active" : ""}" data-tab="page-${i}">${escapeHTML(label)}</button>`;
    })
    .join("\n      ");

  const panels = report.pages
    .map((page, i) => {
      const violationSelectors = new Set<string>();
      for (const rule of page.rules) {
        for (const v of rule.violations) {
          for (const el of v.elements) {
            violationSelectors.add(el.selector);
          }
        }
      }

      const focusMap = buildFocusMapHTML(
        page.focusSequence ?? [],
        pageScreenshotForMap(page),
        page.pageDimensions,
        violationSelectors,
      );

      return `
      <div class="tab-panel${i === 0 ? " active" : ""}" id="page-${i}">
        <h3 style="color: #38bdf8; margin-bottom: 1rem;">${escapeHTML(page.url)}</h3>
        ${buildMetaCards(page.crawl, page.summary)}
        ${buildPrepareNote(page.crawl)}
        ${focusMap}
        <h4 style="margin: 1.5rem 0 1rem; font-size: 1rem;">Rules</h4>
        ${buildRulesHTML(page.rules)}
        ${page.aiFocusOrderAnalysis ? buildFocusOrderAnalysisHTML(page.aiFocusOrderAnalysis) : ""}
        ${buildWidgetClassificationsHTML(page.widgetClassifications)}
        ${buildAccessibleNameSuggestionsHTML(page.accessibleNameSuggestions)}
        ${buildFocusIndicatorScoresHTML(page.focusIndicatorScores)}
        ${page.aiSummary ? buildAISummaryHTML(page.aiSummary) : ""}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Keylens Multi-Page Report</title>
  ${COMMON_STYLES(statusColor)}
</head>
<body>
  <div class="container">
    <header>
      <h1>Keylens Multi-Page Report <span>v${escapeHTML(report.version)}</span></h1>
      <p style="color: #94a3b8; margin-top: 0.5rem;">${report.urls.length} page(s) audited</p>
      <p style="color: #64748b; font-size: 0.8rem;">${escapeHTML(report.timestamp)}</p>
    </header>

    <div class="meta">
      <div class="meta-card">
        <div class="label">Pages</div>
        <div class="value">${report.summary.totalPages}</div>
      </div>
      <div class="meta-card">
        <div class="label">Pages with Errors</div>
        <div class="value" style="color: ${report.summary.pagesWithErrors > 0 ? "#ef4444" : "#22c55e"}">${report.summary.pagesWithErrors}</div>
      </div>
      <div class="meta-card">
        <div class="label">Total Errors</div>
        <div class="value" style="color: ${report.summary.totalErrors > 0 ? "#ef4444" : "#22c55e"}">${report.summary.totalErrors}</div>
      </div>
      <div class="meta-card">
        <div class="label">Total Warnings</div>
        <div class="value" style="color: ${report.summary.totalWarnings > 0 ? "#f59e0b" : "#22c55e"}">${report.summary.totalWarnings}</div>
      </div>
      <div class="meta-card">
        <div class="label">Rule Errors</div>
        <div class="value" style="color: ${(report.summary.ruleErrors ?? 0) > 0 ? "#f59e0b" : "#22c55e"}">${report.summary.ruleErrors ?? 0}</div>
      </div>
      <div class="meta-card">
        <div class="label">Avg Score</div>
        <div class="value" style="color: ${report.summary.score >= 70 ? "#22c55e" : report.summary.score >= 50 ? "#f59e0b" : "#ef4444"}">${report.summary.score}/100${report.summary.scoreComplete === false ? " (incomplete)" : ""}</div>
      </div>
    </div>

    <div class="tabs">
      ${tabs}
    </div>
    ${panels}

    ${buildCrossPagePatternsHTML(report.crossPagePatterns)}

    ${report.aiSummary ? buildAISummaryHTML(report.aiSummary) : ""}

    <footer>
      Generated by Keylens v${escapeHTML(report.version)} &bull; ${escapeHTML(report.timestamp)}
    </footer>
  </div>

  <script>
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

// ─── Shared Fragments ─────────────────────────────────────────────

function buildFixSuggestionHTML(fix: string | FixSuggestion): string {
  if (typeof fix === "string") {
    return `<div class="fix">${escapeHTML(fix)}</div>`;
  }
  const effortColor =
    fix.estimatedEffort === "low"
      ? "#22c55e"
      : fix.estimatedEffort === "medium"
        ? "#f59e0b"
        : "#ef4444";
  const codeBlock =
    fix.codeBefore && fix.codeAfter
      ? `<pre style="margin: 0.5rem 0; padding: 0.5rem; background: #0f172a; border-radius: 0.25rem; font-size: 0.8rem; overflow-x: auto;"><code><span style="color: #ef4444;">- ${escapeHTML(fix.codeBefore)}</span>
<span style="color: #22c55e;">+ ${escapeHTML(fix.codeAfter)}</span></code></pre>`
      : "";
  return `<div class="fix">
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
      <span style="min-width: 0;">${escapeHTML(fix.summary)}</span>
      <span style="color: ${effortColor}; font-size: 0.75rem; font-weight: 600; white-space: nowrap; flex-shrink: 0;">${escapeHTML(fix.estimatedEffort)} effort</span>
    </div>
    ${codeBlock}
    <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #94a3b8;">${escapeHTML(fix.explanation)}</p>
  </div>`;
}

function buildFocusOrderAnalysisHTML(
  analysis: string | AIFocusOrderResult,
): string {
  if (typeof analysis === "string") {
    return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">AI Focus Order Analysis</h2>
    <div class="rule passed" style="border-color: #38bdf8;"><p>${escapeHTML(analysis)}</p></div>`;
  }
  const assessColor =
    analysis.overallAssessment === "good"
      ? "#22c55e"
      : analysis.overallAssessment === "acceptable"
        ? "#f59e0b"
        : "#ef4444";
  const issues = analysis.issues
    .map((issue) => {
      const sevColor =
        issue.severity === "error"
          ? "#ef4444"
          : issue.severity === "warning"
            ? "#f59e0b"
            : "#38bdf8";
      return `
        <div class="violation">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: ${sevColor}; font-weight: 600;">#${issue.elementIndex}</span>
            <span class="message">${escapeHTML(issue.description)}</span>
            <span class="status-badge" style="background: ${sevColor}22; color: ${sevColor}; border-color: ${sevColor}44; font-size: 0.75rem;">${escapeHTML(issue.severity)}</span>
          </div>
          <p style="margin-top: 0.5rem; color: #94a3b8; font-size: 0.875rem;">${escapeHTML(issue.suggestion)}</p>
        </div>`;
    })
    .join("");
  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">AI Focus Order Analysis</h2>
    <div class="rule ${analysis.overallAssessment === "good" ? "passed" : analysis.overallAssessment === "acceptable" ? "warning" : "failed"}">
      <div class="rule-header">
        <span class="rule-name">${escapeHTML(analysis.summary)}</span>
        <span class="status-badge" style="background: ${assessColor}22; color: ${assessColor}; border-color: ${assessColor}44;">${escapeHTML(analysis.overallAssessment)}</span>
      </div>
      ${issues}
    </div>`;
}

function buildAccessibleNameSuggestionsHTML(
  suggestions?: AccessibleNameSuggestion[],
): string {
  if (!suggestions || suggestions.length === 0) return "";

  const items = suggestions
    .map((s) => {
      const conf = Math.round(s.confidence * 100);
      return `
        <div class="rule passed" style="border-color: #38bdf8;">
          <div class="rule-header">
            <span class="rule-name" style="font-family: monospace; font-size: 0.875rem;">${escapeHTML(s.element.selector)}</span>
            <span class="status-badge" style="background: #38bdf822; color: #38bdf8; border-color: #38bdf844;">${conf}% confidence</span>
          </div>
          <p style="margin-top: 0.5rem; color: #22c55e;">Label: <strong>"${escapeHTML(s.suggestedLabel)}"</strong></p>
          ${s.suggestedRole ? `<p style="color: #f59e0b;">Role: <strong>${escapeHTML(s.suggestedRole)}</strong></p>` : ""}
          <p style="margin-top: 0.25rem; color: #94a3b8; font-size: 0.875rem;">${escapeHTML(s.reasoning)}</p>
        </div>`;
    })
    .join("");

  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Accessible Name Suggestions</h2>
    ${items}`;
}

function buildWidgetClassificationsHTML(
  classifications?: WidgetClassification[],
): string {
  if (!classifications || classifications.length === 0) return "";

  const items = classifications
    .map((wc) => {
      const conf = Math.round(wc.confidence * 100);
      const keyboard = wc.expectedKeyboard
        .map(
          (kb) =>
            `<li><strong>${escapeHTML(kb.key)}</strong>: ${escapeHTML(kb.expectedBehavior)}</li>`,
        )
        .join("");
      return `
        <div class="rule passed" style="border-color: #38bdf8;">
          <div class="rule-header">
            <span class="rule-name">${escapeHTML(wc.pattern)}</span>
            <span class="status-badge" style="background: #38bdf822; color: #38bdf8; border-color: #38bdf844;">${conf}% confidence</span>
          </div>
          <p style="color: #94a3b8; margin-top: 0.5rem;">${escapeHTML(wc.element.accessibleName || wc.element.selector)}</p>
          ${keyboard ? `<ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: #cbd5e1; font-size: 0.875rem;">${keyboard}</ul>` : ""}
        </div>`;
    })
    .join("");

  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Widget Classifications</h2>
    ${items}`;
}

function buildFocusIndicatorScoresHTML(scores?: FocusIndicatorScore[]): string {
  if (!scores || scores.length === 0) return "";

  const items = scores
    .map((fis) => {
      const scoreColor =
        fis.score >= 8 ? "#22c55e" : fis.score >= 5 ? "#f59e0b" : "#ef4444";
      const contrastColor =
        fis.contrast === "sufficient"
          ? "#22c55e"
          : fis.contrast === "low"
            ? "#f59e0b"
            : "#ef4444";
      const visibilityColor =
        fis.visibility === "clear"
          ? "#22c55e"
          : fis.visibility === "subtle"
            ? "#f59e0b"
            : "#ef4444";
      return `
        <div class="rule ${fis.score >= 8 ? "passed" : fis.score >= 5 ? "warning" : "failed"}">
          <div class="rule-header">
            <span class="rule-name" style="font-family: monospace; font-size: 0.875rem;">${escapeHTML(fis.element.selector)}</span>
            <span class="status-badge" style="background: ${scoreColor}22; color: ${scoreColor}; border-color: ${scoreColor}44; font-size: 1rem; font-weight: bold;">${fis.score}/10</span>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
            <span style="font-size: 0.8rem;">Contrast: <strong style="color: ${contrastColor};">${escapeHTML(fis.contrast)}</strong></span>
            <span style="font-size: 0.8rem;">Visibility: <strong style="color: ${visibilityColor};">${escapeHTML(fis.visibility)}</strong></span>
          </div>
          ${fis.recommendation ? `<p style="margin-top: 0.5rem; color: #94a3b8; font-size: 0.875rem;">${escapeHTML(fis.recommendation)}</p>` : ""}
        </div>`;
    })
    .join("");

  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Focus Indicator Quality</h2>
    ${items}`;
}

function buildAISummaryHTML(aiSummary: string | AIReportSummary): string {
  if (typeof aiSummary === "string") {
    return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">AI Summary</h2>
    <div class="rule passed" style="border-color: #38bdf8;"><p>${escapeHTML(aiSummary)}</p></div>`;
  }

  const scoreColor =
    aiSummary.aiSeverityRating >= 70
      ? "#22c55e"
      : aiSummary.aiSeverityRating >= 50
        ? "#f59e0b"
        : "#ef4444";

  const criticalHTML =
    aiSummary.criticalIssues.length > 0
      ? `<div style="margin-top: 1rem;">
          <strong style="color: #ef4444;">Critical Issues:</strong>
          <ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: #fca5a5; font-size: 0.875rem;">
            ${aiSummary.criticalIssues.map((i) => `<li>${escapeHTML(i)}</li>`).join("")}
          </ul>
        </div>`
      : "";

  const fixesHTML =
    aiSummary.prioritizedFixes.length > 0
      ? `<div style="margin-top: 1rem;">
          <strong>Prioritized Fixes:</strong>
          <div style="margin-top: 0.5rem;">
            ${aiSummary.prioritizedFixes
              .map((pf) => {
                const effortColor =
                  pf.effort === "low"
                    ? "#22c55e"
                    : pf.effort === "medium"
                      ? "#f59e0b"
                      : "#ef4444";
                const impactColor =
                  pf.impact === "high"
                    ? "#22c55e"
                    : pf.impact === "medium"
                      ? "#f59e0b"
                      : "#ef4444";
                return `<div class="violation">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
                  <span style="min-width: 0;">${escapeHTML(pf.fix)}</span>
                  <span style="display: inline-block; font-size: 0.75rem; white-space: nowrap; flex-shrink: 0; text-align: right;"><span style="color: ${effortColor}; font-weight: 600;">${escapeHTML(pf.effort)}</span>&nbsp;effort,&nbsp;<span style="color: ${impactColor}; font-weight: 600;">${escapeHTML(pf.impact)}</span>&nbsp;impact</span>
                </div>
              </div>`;
              })
              .join("")}
          </div>
        </div>`
      : "";

  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">AI Summary</h2>
    <div class="rule passed" style="border-color: #38bdf8;">
      <div class="rule-header">
        <span class="rule-name">${escapeHTML(aiSummary.overview)}</span>
        <span class="status-badge" style="background: ${scoreColor}22; color: ${scoreColor}; border-color: ${scoreColor}44; font-size: 0.875rem; font-weight: bold; white-space: nowrap; flex-shrink: 0;">AI Score: ${aiSummary.aiSeverityRating}/100</span>
      </div>
      ${criticalHTML}
      ${fixesHTML}
      <p style="margin-top: 1rem; color: #67e8f9; font-size: 0.875rem;">${escapeHTML(aiSummary.recommendation)}</p>
    </div>`;
}

function buildCrossPagePatternsHTML(patterns?: CrossPagePattern[]): string {
  if (!patterns || patterns.length === 0) return "";

  const items = patterns
    .map((cp) => {
      const sevColor =
        cp.severity === "error"
          ? "#ef4444"
          : cp.severity === "warning"
            ? "#f59e0b"
            : "#38bdf8";
      const status =
        cp.severity === "error"
          ? "failed"
          : cp.severity === "warning"
            ? "warning"
            : "passed";
      const pages = cp.affectedPages
        .map((u) => {
          try {
            return escapeHTML(new URL(u).pathname);
          } catch {
            return escapeHTML(u);
          }
        })
        .join(", ");
      return `
        <div class="rule ${status}">
          <div class="rule-header">
            <span class="rule-name">${escapeHTML(cp.description)}</span>
            <span class="status-badge" style="background: ${sevColor}22; color: ${sevColor}; border-color: ${sevColor}44;">${escapeHTML(cp.type)}</span>
          </div>
          <p style="margin-top: 0.5rem; color: #94a3b8; font-size: 0.875rem;">Pages: ${pages}</p>
          <p style="margin-top: 0.25rem; color: #67e8f9; font-size: 0.875rem;">${escapeHTML(cp.suggestion)}</p>
        </div>`;
    })
    .join("");

  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Cross-Page Patterns</h2>
    ${items}`;
}

function COMMON_STYLES(statusColor: string): string {
  return `<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { border-bottom: 1px solid #334155; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    h1 { font-size: 1.5rem; color: #38bdf8; }
    h1 span { color: #64748b; font-weight: normal; font-size: 0.875rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .meta-card { background: #1e293b; border-radius: 0.5rem; padding: 1rem; }
    .meta-card .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta-card .value { font-size: 1.5rem; font-weight: bold; color: #f1f5f9; }
    .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44; white-space: nowrap; flex-shrink: 0; }
    .rule { background: #1e293b; border-radius: 0.5rem; padding: 1.25rem; margin-bottom: 0.75rem; border-left: 3px solid; }
    .rule.passed { border-color: #22c55e; }
    .rule.failed { border-color: #ef4444; }
    .rule.warning { border-color: #f59e0b; }
    .rule-header { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
    .rule-name { font-weight: 600; font-size: 1rem; min-width: 0; }
    .violation { background: #0f172a; border-radius: 0.375rem; padding: 1rem; margin-top: 0.75rem; }
    .violation .message { color: #f1f5f9; margin-bottom: 0.5rem; }
    .violation .elements { font-family: 'SF Mono', monospace; font-size: 0.8rem; color: #94a3b8; overflow-wrap: break-word; word-break: break-all; }
    .violation .element-item { padding: 0.375rem 0.5rem; border-bottom: 1px solid #1e293b; }
    .violation .element-item:last-child { border-bottom: none; }
    .violation .element-head { display: flex; align-items: baseline; gap: 0.5rem; }
    .violation .tab-pos { color: #38bdf8; font-size: 0.7rem; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
    .violation .selector-text { min-width: 0; color: #94a3b8; margin-top: 0.125rem; word-break: break-all; }
    .violation details { margin-top: 0.25rem; }
    .violation details summary { cursor: pointer; color: #64748b; font-size: 0.8rem; padding: 0.375rem 0.5rem; }
    .violation details summary:hover { color: #94a3b8; }
    .violation .impact { color: #64748b; font-size: 0.8rem; font-style: italic; margin-top: 0.375rem; }
    .violation .wcag-badges { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.375rem; }
    .violation .wcag-badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; background: #38bdf811; color: #38bdf8; border: 1px solid #38bdf833; text-decoration: none; }
    .violation .wcag-badge:hover { background: #38bdf822; }
    .rule-meta { color: #94a3b8; font-size: 0.8rem; margin-top: 0.25rem; }
    .element-name { color: #22c55e; font-size: 0.75rem; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40ch; }
    .violation .fix { background: #164e63; border-radius: 0.375rem; padding: 0.75rem; margin-top: 0.5rem; color: #67e8f9; font-size: 0.875rem; }
    .focus-map { position: relative; margin: 2rem 0; background: #1e293b; border-radius: 0.5rem; overflow: hidden; }
    .focus-map img { width: 100%; display: block; opacity: 0.3; }
    .focus-map .focus-lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .focus-marker { position: absolute; width: 28px; height: 28px; border-radius: 50%; background: #38bdf822; border: 2px solid #38bdf8; color: #38bdf8; font-size: 0.7rem; font-weight: bold; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); cursor: pointer; transition: all 0.15s ease; z-index: 2; }
    .focus-marker:hover { background: #38bdf844; transform: translate(-50%, -50%) scale(1.2); z-index: 10; }
    .tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid #334155; margin: 1.5rem 0 0; overflow-x: auto; }
    .tab-btn { background: none; border: none; color: #94a3b8; padding: 0.75rem 1.25rem; cursor: pointer; font-size: 0.875rem; border-bottom: 2px solid transparent; white-space: nowrap; }
    .tab-btn:hover { color: #e2e8f0; }
    .tab-btn.active { color: #38bdf8; border-bottom-color: #38bdf8; }
    .tab-panel { display: none; padding: 1.5rem 0; }
    .tab-panel.active { display: block; }
    footer { border-top: 1px solid #334155; padding-top: 1rem; margin-top: 2rem; text-align: center; color: #64748b; font-size: 0.8rem; }
  </style>`;
}

function buildMetaCards(
  crawl: AuditReport["crawl"],
  summary: AuditReport["summary"],
): string {
  return `
    <div class="meta">
      <div class="meta-card">
        <div class="label">Focusable Elements</div>
        <div class="value">${crawl.totalFocusableElements}</div>
      </div>
      <div class="meta-card">
        <div class="label">Unreached</div>
        <div class="value" style="color: ${crawl.unreachedElements > 0 ? "#ef4444" : "#22c55e"}">${crawl.unreachedElements}</div>
      </div>
      <div class="meta-card">
        <div class="label">Errors</div>
        <div class="value" style="color: ${summary.totalErrors > 0 ? "#ef4444" : "#22c55e"}">${summary.totalErrors}</div>
      </div>
      <div class="meta-card">
        <div class="label">Warnings</div>
        <div class="value" style="color: ${summary.totalWarnings > 0 ? "#f59e0b" : "#22c55e"}">${summary.totalWarnings}</div>
      </div>
      <div class="meta-card">
        <div class="label">Score</div>
        <div class="value" style="color: ${summary.score >= 70 ? "#22c55e" : summary.score >= 50 ? "#f59e0b" : "#ef4444"}">${summary.score}/100${summary.scoreComplete === false ? " (incomplete)" : ""}</div>
      </div>
    </div>`;
}

function buildPrepareNote(crawl: AuditReport["crawl"]): string {
  const prepare = crawl.prepare;
  if (
    !prepare?.dismissals.length &&
    !prepare?.warnings.length &&
    !prepare?.scrollContainerExpanded
  )
    return "";
  const dismissals = (prepare.dismissals ?? [])
    .map(
      (d) =>
        `${escapeHTML(d.provider)} (${escapeHTML(d.action)}${d.verified ? "" : ", unverified"})`,
    )
    .join(", ");
  const warnings = (prepare.warnings ?? []).map(escapeHTML).join("; ");
  const expansion = prepare.scrollContainerExpanded
    ? `${escapeHTML(prepare.scrollContainerExpanded.selector)} (${prepare.scrollContainerExpanded.originalHeight}px &rarr; ${prepare.scrollContainerExpanded.expandedHeight}px)`
    : "";
  return `
    <div style="margin: 1rem 0; padding: 0.75rem 1rem; background: #1e293b; border-radius: 0.5rem; font-size: 0.85rem; color: #94a3b8;">
      ${dismissals ? `<div><strong style="color: #e2e8f0;">Overlays dismissed:</strong> ${dismissals}</div>` : ""}
      ${expansion ? `<div style="margin-top: ${dismissals ? "0.25rem" : "0"};"><strong style="color: #e2e8f0;">Scroll container expanded:</strong> ${expansion}</div>` : ""}
      ${warnings ? `<div style="color: #f59e0b; margin-top: ${dismissals || expansion ? "0.25rem" : "0"};"><strong>Prepare warnings:</strong> ${warnings}</div>` : ""}
    </div>`;
}

function buildElementHTML(el: {
  selector: string;
  tabPosition?: number;
  accessibleName?: string;
}): string {
  const badge =
    el.tabPosition != null
      ? `<span class="tab-pos">#${el.tabPosition}</span>`
      : "";
  const name = el.accessibleName
    ? `<span class="element-name" title="${escapeHTML(el.accessibleName)}">${escapeHTML(el.accessibleName)}</span>`
    : "";
  const head =
    badge || name ? `<div class="element-head">${badge}${name}</div>` : "";
  return `<div class="element-item">${head}<div class="selector-text">${escapeHTML(el.selector)}</div></div>`;
}

function buildElementsHTML(
  elements: Array<{
    selector: string;
    tabPosition?: number;
    accessibleName?: string;
  }>,
): string {
  if (elements.length === 0) return "";

  const VISIBLE_COUNT = 3;

  if (elements.length <= VISIBLE_COUNT) {
    return `<div class="elements">${elements.map(buildElementHTML).join("")}</div>`;
  }

  const visible = elements.slice(0, VISIBLE_COUNT);
  const rest = elements.slice(VISIBLE_COUNT);

  return `<div class="elements">
    ${visible.map(buildElementHTML).join("")}
    <details>
      <summary>Show ${rest.length} more element${rest.length === 1 ? "" : "s"}</summary>
      ${rest.map(buildElementHTML).join("")}
    </details>
  </div>`;
}

function buildWcagBadgesHTML(wcag?: string[]): string {
  if (!wcag || wcag.length === 0) return "";
  return `<div class="wcag-badges">${wcag.map((ref) => `<a class="wcag-badge" href="https://www.w3.org/WAI/WCAG21/Understanding/${wcagSlug(ref)}" target="_blank" rel="noopener">WCAG ${escapeHTML(ref)}</a>`).join("")}</div>`;
}

function wcagSlug(ref: string): string {
  const slugs: Record<string, string> = {
    "2.1.1": "keyboard",
    "2.1.2": "no-keyboard-trap",
    "2.4.1": "bypass-blocks",
    "2.4.3": "focus-order",
    "2.4.7": "focus-visible",
    "2.4.11": "focus-not-obscured-minimum",
  };
  return slugs[ref] ?? "keyboard";
}

function buildRulesHTML(rules: AuditReport["rules"]): string {
  return rules
    .map((rule) => {
      const status =
        rule.status === "error"
          ? "error"
          : rule.passed
            ? "passed"
            : rule.violations.some((v) => v.severity === "error")
              ? "failed"
              : "warning";
      const statusLabel =
        rule.status === "error"
          ? "ERROR"
          : rule.passed
            ? "PASS"
            : `${rule.violations.length} issue(s)`;
      return `
      <div class="rule ${status}">
        <div class="rule-header">
          <span class="rule-name">${rule.passed ? "&#10003;" : "&#10007;"} ${escapeHTML(rule.ruleName || rule.ruleId)}</span>
          <span class="status-badge" style="background: ${status === "passed" ? "#22c55e22" : status === "failed" ? "#ef444422" : "#f59e0b22"}; color: ${status === "passed" ? "#22c55e" : status === "failed" ? "#ef4444" : "#f59e0b"}; border-color: ${status === "passed" ? "#22c55e44" : status === "failed" ? "#ef444444" : "#f59e0b44"};">${statusLabel}</span>
        </div>
        ${rule.ruleDescription ? `<div class="rule-meta">${escapeHTML(rule.ruleDescription)}</div>` : ""}
        ${rule.error ? `<div class="rule-meta">Evaluation error: ${escapeHTML(rule.error.message)}</div>` : ""}
        ${rule.violations
          .map(
            (v) => `
          <div class="violation">
            <div class="message">${escapeHTML(v.message)}</div>
            ${v.impact ? `<div class="impact">${escapeHTML(v.impact)}</div>` : ""}
            ${buildWcagBadgesHTML(v.wcag)}
            ${buildElementsHTML(v.elements)}
            ${v.fixSuggestion ? buildFixSuggestionHTML(v.fixSuggestion) : ""}
          </div>`,
          )
          .join("")}
      </div>`;
    })
    .join("");
}
