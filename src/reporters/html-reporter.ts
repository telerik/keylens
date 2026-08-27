import type {
  AuditReport,
  FocusedElement,
  RovingTabindexGroupResult,
  InteractiveElement,
  BoundingRect,
  Severity,
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

// ─── Helpers ──────────────────────────────────────────────────────

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Semantic color kinds backed by the `--klr-*` CSS variables defined in
 * COMMON_STYLES. All colored UI in this reporter is expressed in terms of
 * these four kinds — no hardcoded hex values should appear outside of the
 * `:root` variable definitions themselves.
 */
type Kind = "success" | "warning" | "error" | "accent";

/** CSS var() reference for a kind's contrast-tuned variant — used for text
 * and icons rendered directly on a background surface (page/card bg, tinted
 * badge or fix boxes), guaranteeing readable contrast (this matters most for
 * `error`, whose base red is too dark to read well on our dark background). */
function onBgVar(kind: Kind): string {
  return `var(--klr-${kind}-on-bg)`;
}

/**
 * Inline style for a pill/badge: a subtle tinted background + tinted border,
 * both derived on the fly from the kind's single base variable via
 * `color-mix()`, plus on-bg text for contrast. No dedicated "subtle"
 * variables are declared in `:root` — they'd only ever be used here.
 */
function badgeStyle(kind: Kind, extra = ""): string {
  return `background: color-mix(in srgb, var(--klr-${kind}) 13%, transparent); color: ${onBgVar(kind)}; border-color: color-mix(in srgb, var(--klr-${kind}) 27%, transparent);${extra ? ` ${extra}` : ""}`;
}

function buildStatusKind(errors: number, warnings: number): Kind {
  if (errors > 0) return "error";
  if (warnings > 0) return "warning";
  return "success";
}

/** Map a rule violation's severity to the badge `Kind` used to color it. */
function severityKind(severity: Severity): Kind {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "accent";
}

/** Highest-priority severity across all issues flagged on one focus stop
 * (error beats warning beats info) — drives the marker's dot color. */
function highestSeverity(
  issues?: Array<{ severity: Severity }>,
): Severity | undefined {
  if (!issues?.length) return undefined;
  if (issues.some((i) => i.severity === "error")) return "error";
  if (issues.some((i) => i.severity === "warning")) return "warning";
  return "info";
}

/** Inline SVG icon, paths sourced from Progress/Kendo's kendo-svg-icons (outline set). */
function klrIcon(paths: string, className: string): string {
  return `<svg class="klr-icon ${className}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${paths}</svg>`;
}

const ICON_CHECK = klrIcon(
  '<path d="M3.75 13.5L9 18.75L21 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-status",
);
const ICON_X = klrIcon(
  '<path d="M18.75 5.25L5.25 18.75M18.75 18.75L5.25 5.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-status",
);
const ICON_CHEVRON_DOWN = klrIcon(
  '<path d="M19.5 9L12 16.5L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "rule-chevron",
);
const ICON_BRIGHTNESS = klrIcon(
  '<path d="M12 3.75V1.5M6 6L4.5 4.5M6 18L4.5 19.5M18 6L19.5 4.5M18 18L19.5 19.5M3.75 12H1.5M12 20.25V22.5M20.25 12H22.5M17.25 12C17.25 14.8995 14.8995 17.25 12 17.25C9.10051 17.25 6.75 14.8995 6.75 12C6.75 9.10051 9.10051 6.75 12 6.75C14.8995 6.75 17.25 9.10051 17.25 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-theme",
);
const ICON_CARET_TO_LEFT = klrIcon(
  '<path d="M18 19.5L10.5 12L18 4.5M6.75 4.5V19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-pager",
);
const ICON_CARET_LEFT = klrIcon(
  '<path d="M15 19.5L7.5 12L15 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-pager",
);
const ICON_CARET_RIGHT = klrIcon(
  '<path d="M9 4.5L16.5 12L9 19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-pager",
);
const ICON_CARET_TO_RIGHT = klrIcon(
  '<path d="M6 4.5L13.5 12L6 19.5M17.25 4.5V19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-pager",
);
const ICON_TARGET = klrIcon(
  '<path d="M11.9999 12L20.9999 3M18.3636 5.63624C16.7695 4.04588 14.6366 3.11176 12.3867 3.01868C10.1369 2.92559 7.93406 3.68032 6.21401 5.13355C4.49397 6.58679 3.38201 8.63268 3.09812 10.8665C2.81422 13.1003 3.37907 15.3593 4.68092 17.1965C5.98277 19.0338 7.92678 20.3156 10.1284 20.7882C12.33 21.2609 14.6288 20.89 16.57 19.749C18.5113 18.6079 19.9536 16.7798 20.6116 14.6263C21.2696 12.4729 21.0953 10.1509 20.1233 8.11968M15.1818 8.81811C14.4374 8.07461 13.456 7.61544 12.4082 7.52041C11.3604 7.42539 10.3124 7.7005 9.4464 8.29794C8.58038 8.89538 7.95108 9.77738 7.66786 10.7906C7.38464 11.8039 7.46541 12.8844 7.89613 13.8443C8.32685 14.8042 9.0803 15.5828 10.0255 16.0449C10.9707 16.5069 12.048 16.6231 13.07 16.3734C14.092 16.1236 14.9942 15.5237 15.6198 14.6777C16.2454 13.8318 16.5548 12.7935 16.4943 11.7431" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  "icon-pager",
);

function pageScreenshotForMap(report: AuditReport): string {
  if (report.config.capture?.page === "viewport") {
    return "";
  }
  return getInlineAssetData(report.assets, report.pageScreenshotAssetId) ?? "";
}

// ─── Focus Map ────────────────────────────────────────────────────

/**
 * A focus stop's position in both coordinate spaces the map needs:
 * `xPct`/`yPct` (percent of page width/height) for CSS/SVG placement in the
 * possibly non-square map, and `px`/`py` (raw page pixels) for angle math —
 * percentage deltas don't reflect the true visual angle once width and
 * height are scaled by different factors, only raw pixel deltas do.
 */
interface FocusMapPoint {
  px: number;
  py: number;
  xPct: number;
  yPct: number;
}

interface FocusMapSegment {
  path: string;
  arrow: { xPct: number; yPct: number; angle: number };
}

function toFocusMapPoint(
  el: FocusedElement,
  dims: { width: number; height: number },
): FocusMapPoint {
  return rectToFocusMapPoint(el.pageRect ?? el.boundingRect, dims);
}

function rectToFocusMapPoint(
  rect: BoundingRect,
  dims: { width: number; height: number },
): FocusMapPoint {
  const px = rect.x + rect.width / 2;
  const py = rect.y + rect.height / 2;
  return {
    px,
    py,
    xPct: (px / dims.width) * 100,
    yPct: (py / dims.height) * 100,
  };
}

/** Tooltip for a roving-tabindex satellite marker (reached via arrow keys, not Tab). */
function buildRovingSatelliteTooltipHTML(
  member: InteractiveElement | undefined,
  selector: string,
  containerRole: string,
  activeMarkerIndex: number | undefined,
): string {
  const row = (label: string, value?: string) =>
    value
      ? `<div class="focus-tooltip-row"><span>${label}</span><span class="focus-tooltip-value focus-tooltip-value--clamp">${escapeHTML(value)}</span></div>`
      : "";
  const roleLabel = member?.role || "element";

  return `<div class="focus-tooltip">
      <div class="focus-tooltip-title">&lt;${escapeHTML(roleLabel)}&gt; <span>via arrow keys</span></div>
      ${row("Selector", selector)}
      ${row("Accessible name", member?.accessibleName)}
      ${row("Composite widget", containerRole)}
      ${row(
        "Reached from",
        activeMarkerIndex ? `Tab stop #${activeMarkerIndex}` : undefined,
      )}
    </div>`;
}

/**
 * Build dashed satellite markers + connectors for roving-tabindex composite
 * widget members that are only reachable via arrow keys, not Tab - these
 * never appear in `focusSequence` so the plain focus map would otherwise
 * make them invisible.
 */
function buildRovingTabindexOverlayHTML(
  groups: RovingTabindexGroupResult[] | undefined,
  interactiveElements: InteractiveElement[] | undefined,
  dims: { width: number; height: number },
  markerIndexBySelector: Map<string, number>,
  idPrefix = "",
): { markers: string; connectors: string } {
  if (!groups?.length) return { markers: "", connectors: "" };

  const elementsBySelector = new Map(
    (interactiveElements ?? []).map((el) => [el.selector, el]),
  );
  const markers: string[] = [];
  const connectors: string[] = [];
  let satelliteIndex = 0;

  for (const group of groups) {
    const [active, ...satellites] = group.reachedViaArrowKeys;
    if (!active || satellites.length === 0) continue;

    const activePoint = rectToFocusMapPoint(active.pageRect, dims);
    const activeMarkerIndex = markerIndexBySelector.get(active.selector);

    for (const satellite of satellites) {
      satelliteIndex++;
      const point = rectToFocusMapPoint(satellite.pageRect, dims);
      // Outline path first (wider, white) so the accent path drawn on top
      // leaves a crisp border, matching the main route's rendering.
      connectors.push(
        `<path class="route-roving-outline" vector-effect="non-scaling-stroke" d="M ${activePoint.xPct.toFixed(3)} ${activePoint.yPct.toFixed(3)} L ${point.xPct.toFixed(3)} ${point.yPct.toFixed(3)}"/>`,
      );
      connectors.push(
        `<path class="route-roving" vector-effect="non-scaling-stroke" d="M ${activePoint.xPct.toFixed(3)} ${activePoint.yPct.toFixed(3)} L ${point.xPct.toFixed(3)} ${point.yPct.toFixed(3)}"/>`,
      );
      const tooltip = buildRovingSatelliteTooltipHTML(
        elementsBySelector.get(satellite.selector),
        satellite.selector,
        group.containerRole,
        activeMarkerIndex,
      );
      markers.push(
        `<div class="focus-marker focus-marker--roving" id="${idPrefix}roving-${satelliteIndex}" data-selector="${escapeHTML(satellite.selector)}" tabindex="0" style="left:${point.xPct.toFixed(3)}%;top:${point.yPct.toFixed(3)}%;">&#8646;${tooltip}</div>`,
      );
    }
  }

  return {
    markers: markers.join("\n      "),
    connectors: connectors.join("\n        "),
  };
}

/**
 * Build the SVG path `d` and arrowhead midpoint/angle connecting two focus
 * stops. The path and arrow position use percent coordinates (correct for
 * the stretched SVG/CSS space); the angle uses raw pixel coordinates so it
 * matches the physical rotation the arrow's CSS `transform` applies.
 */
function buildFocusMapSegment(
  p1: FocusMapPoint,
  p2: FocusMapPoint,
): FocusMapSegment {
  const angle = (Math.atan2(p2.py - p1.py, p2.px - p1.px) * 180) / Math.PI;
  return {
    path: `M ${p1.xPct.toFixed(3)} ${p1.yPct.toFixed(3)} L ${p2.xPct.toFixed(3)} ${p2.yPct.toFixed(3)}`,
    arrow: {
      xPct: p1.xPct + (p2.xPct - p1.xPct) / 2,
      yPct: p1.yPct + (p2.yPct - p1.yPct) / 2,
      angle,
    },
  };
}

/** Build the rows shown in a focus marker's hover tooltip from data already
 * captured during the crawl — no extra DOM inspection is needed. */
function buildFocusTooltipHTML(
  el: FocusedElement,
  index: number,
  total: number,
  issues?: Array<{ ruleName: string; severity: Severity }>,
): string {
  const row = (label: string, value?: string | null, valueClass = "") =>
    value
      ? `<div class="focus-tooltip-row"><span>${label}</span><span class="focus-tooltip-value${valueClass ? ` ${valueClass}` : ""}">${escapeHTML(value)}</span></div>`
      : "";
  const rawRow = (label: string, html?: string) =>
    html
      ? `<div class="focus-tooltip-row"><span>${label}</span><span class="focus-tooltip-value focus-tooltip-value--badges">${html}</span></div>`
      : "";

  const ariaLabel = el.ariaAttributes?.["aria-label"];
  const focusIndicator =
    el.hasFocusIndicator === true
      ? "Yes"
      : el.hasFocusIndicator === false
        ? "No"
        : null;
  const issuesHTML = issues?.length
    ? issues
        .map(
          (issue) =>
            `<span class="status-badge" style="${badgeStyle(severityKind(issue.severity), "font-size: 0.7rem;")}">${escapeHTML(issue.ruleName)}</span>`,
        )
        .join(" ")
    : undefined;

  return `<div class="focus-tooltip">
      <div class="focus-tooltip-title">&lt;${escapeHTML(el.tagName.toLowerCase())}&gt; <span>${index + 1} of ${total}</span></div>
      ${rawRow(issues && issues.length > 1 ? "Issues" : "Issue", issuesHTML)}
      ${row("Selector", el.selector, "focus-tooltip-value--clamp")}
      ${row("Role", el.role)}
      ${row("Accessible name", el.accessibleName)}
      ${row("ARIA label", ariaLabel)}
      ${row("Tab index", el.tabindexAttr != null ? String(el.tabindexAttr) : "(not specified)")}
      ${row("Focus indicator", focusIndicator)}
      ${row("Obscured on focus", el.isObscured != null ? (el.isObscured ? "Yes" : "No") : null)}
      ${row("Landmark", el.parentContext)}
    </div>`;
}

/**
 * Build HTML for the focus map: the page screenshot with numbered stop
 * markers connected by straight lines in tab order, each with a single
 * arrowhead at its midpoint showing direction. Three elements only: line,
 * arrow, dot — all blue. The only color change is the dot itself, which
 * turns amber/yellow when the stop is flagged by a rule violation.
 */
export function buildFocusMapHTML(
  focusSequence: FocusedElement[],
  pageScreenshot: string,
  pageDimensions?: { width: number; height: number },
  violationsBySelector?: Map<
    string,
    Array<{ ruleName: string; severity: Severity }>
  >,
  idPrefix = "",
  rovingTabindexGroups?: RovingTabindexGroupResult[],
  interactiveElements?: InteractiveElement[],
): string {
  if (!focusSequence.length || !pageScreenshot) return "";

  const dims = pageDimensions ?? { width: 1280, height: 720 };

  const points = focusSequence.map((el) => toFocusMapPoint(el, dims));

  const segments = points
    .slice(1)
    .map((p2, i) => buildFocusMapSegment(points[i]!, p2));

  const issuesFlags = focusSequence.map((el) =>
    violationsBySelector?.get(el.selector),
  );

  const markers = focusSequence.map((el, i) => {
    const { xPct, yPct } = points[i]!;
    const issues = issuesFlags[i];
    const severity = highestSeverity(issues);
    const cls =
      severity === "error"
        ? "focus-marker focus-marker--violation focus-marker--violation-error"
        : severity
          ? "focus-marker focus-marker--violation"
          : "focus-marker";
    const tooltip = buildFocusTooltipHTML(el, i, focusSequence.length, issues);
    // Jump target for the rule panel's "Highlight" button and reverse lookup for marker clicks.
    const roleAttr = severity ? ' role="button"' : "";

    return `<div class="${cls}" id="${idPrefix}marker-${i + 1}" data-selector="${escapeHTML(el.selector)}" tabindex="0"${roleAttr} style="left:${xPct.toFixed(3)}%;top:${yPct.toFixed(3)}%;">${i + 1}${tooltip}</div>`;
  });

  // Outline paths render first (wider, white) so the accent path drawn on
  // top leaves a crisp 1px white border on both sides — filter: drop-shadow
  // on a stroked path is blurry/inconsistent across renderers, a doubled
  // stroke is not.
  const connectors = segments
    .map(
      (s) =>
        `<path class="route-outline" vector-effect="non-scaling-stroke" d="${s.path}"/>`,
    )
    .concat(
      segments.map(
        (s) =>
          `<path class="route" vector-effect="non-scaling-stroke" d="${s.path}"/>`,
      ),
    )
    .join("\n        ");

  const arrows = segments
    .map(
      (s) =>
        `<div class="route-arrow" style="left:${s.arrow.xPct.toFixed(3)}%;top:${s.arrow.yPct.toFixed(3)}%;transform:translate(-50%,-50%) rotate(${s.arrow.angle.toFixed(2)}deg);"></div>`,
    )
    .join("\n        ");

  const markerIndexBySelector = new Map(
    focusSequence.map((el, i) => [el.selector, i + 1]),
  );
  const rovingOverlay = buildRovingTabindexOverlayHTML(
    rovingTabindexGroups,
    interactiveElements,
    dims,
    markerIndexBySelector,
    idPrefix,
  );

  return `
    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Focus Order Map</h2>
    <div class="focus-map">
      <div class="focus-map-surface">
        <img src="data:image/png;base64,${pageScreenshot}" alt="Page screenshot">
        <svg class="focus-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          ${connectors}
          ${rovingOverlay.connectors}
        </svg>
      </div>
      ${arrows}
      ${markers.join("\n      ")}
      ${rovingOverlay.markers}
    </div>`;
}

// ─── Single Page HTML ─────────────────────────────────────────────

export function renderHTML(input: AuditReport): string {
  const report = input;
  const { summary, rules, crawl, url } = report;
  const statusKind = buildStatusKind(
    summary.totalErrors,
    summary.totalWarnings,
  );

  // Collect selectors of elements with violations for focus map color-coding
  // and tooltip issue listing — a stop can carry multiple issues/rules.
  const violationsBySelector = new Map<
    string,
    Array<{ ruleName: string; severity: Severity }>
  >();
  for (const rule of rules) {
    for (const v of rule.violations) {
      for (const el of v.elements) {
        const list = violationsBySelector.get(el.selector) ?? [];
        list.push({ ruleName: v.ruleName, severity: v.severity });
        violationsBySelector.set(el.selector, list);
      }
    }
  }

  const focusMap = buildFocusMapHTML(
    report.focusSequence ?? [],
    pageScreenshotForMap(report),
    report.pageDimensions,
    violationsBySelector,
    "",
    report.rovingTabindexGroups,
    report.interactiveElements,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Keylens Report — ${escapeHTML(url)}</title>
  ${COMMON_STYLES(statusKind)}
</head>
<body>
  <div class="container">
    <header>
      ${THEME_TOGGLE_HTML}
      <h1>Keylens Report <span>v${escapeHTML(report.version)}</span></h1>
      <p style="color: var(--klr-text-subtle); margin-top: 0.5rem;">${escapeHTML(url)}</p>
      <p style="color: var(--klr-text-muted); font-size: 0.8rem;">${escapeHTML(report.timestamp)}</p>
    </header>

    ${buildMetaCards(crawl, summary)}
    ${buildPrepareNote(crawl)}

    ${focusMap}

    <h2 style="margin: 1.5rem 0 1rem; font-size: 1.125rem;">Rules</h2>
    ${buildRulesHTML(rules)}

    <footer>
      Generated by Keylens v${escapeHTML(report.version)} &bull; ${escapeHTML(report.timestamp)}
    </footer>
  </div>
  <script>${RULES_SCRIPT}</script>
</body>
</html>`;
}

/** Light/dark toggle button, pinned to the top-right corner of the header. */
const THEME_TOGGLE_HTML = `<button type="button" id="klr-theme-toggle" class="theme-toggle" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">${ICON_BRIGHTNESS}</button>`;

/**
 * Powers rule expand/collapse, the per-instance issue pager, and "Highlight"
 * (scroll to, center, and focus the matching focus-map marker), plus a
 * reverse link: clicking a violation marker jumps back to and expands the
 * matching rule instance. Scrolling uses a fixed-duration
 * custom animation (klrScrollTo) rather than native smooth-scroll, which
 * drags out over long distances. Inlined once per report — no bundler/build
 * step runs over this static HTML output.
 */
const RULES_SCRIPT = `
    // Light/dark toggle: overrides the default "light dark" color-scheme via a
    // data-theme attribute on <html>, persisted across reloads in localStorage.
    (function () {
      var root = document.documentElement;
      var btn = document.getElementById('klr-theme-toggle');
      var stored = null;
      try { stored = localStorage.getItem('klr-theme'); } catch (e) {}
      var theme = stored === 'light' || stored === 'dark' ? stored : null;
      function apply(t) {
        if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
      }
      apply(theme);
      if (btn) {
        btn.addEventListener('click', function () {
          var current = root.getAttribute('data-theme') ||
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          theme = current === 'dark' ? 'light' : 'dark';
          apply(theme);
          try { localStorage.setItem('klr-theme', theme); } catch (e) {}
        });
      }
    })();

    // Fixed-duration scroll (native "smooth" scrolling scales with distance and can feel sluggish).
    function klrScrollTo(el, block) {
      var rect = el.getBoundingClientRect();
      var targetY = block === 'start'
        ? window.scrollY + rect.top - 24
        : window.scrollY + rect.top - (window.innerHeight / 2 - rect.height / 2);
      var startY = window.scrollY;
      var delta = targetY - startY;
      var duration = 200;
      var startTime = null;
      function step(ts) {
        if (startTime === null) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startY + delta * eased);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    document.querySelectorAll('[data-rule-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        var body = document.getElementById(btn.getAttribute('aria-controls'));
        if (body) body.hidden = expanded;
      });
    });

    document.querySelectorAll('[data-issue-viewer]').forEach(function (viewer) {
      var panels = Array.prototype.slice.call(viewer.querySelectorAll('.issue-instance'));
      var currentEl = viewer.querySelector('[data-pager-current]');
      var highlightBtn = viewer.querySelector('[data-pager-action="highlight"]');
      var firstBtn = viewer.querySelector('[data-pager-action="first"]');
      var prevBtn = viewer.querySelector('[data-pager-action="prev"]');
      var nextBtn = viewer.querySelector('[data-pager-action="next"]');
      var lastBtn = viewer.querySelector('[data-pager-action="last"]');
      var index = 0;

      function show(i) {
        index = Math.max(0, Math.min(panels.length - 1, i));
        panels.forEach(function (p, pi) { p.classList.toggle('active', pi === index); });
        if (currentEl) currentEl.textContent = String(index + 1);
        var active = panels[index];
        var hasTarget = !!(active && active.dataset.markerTarget);
        if (highlightBtn) {
          highlightBtn.disabled = !hasTarget;
          highlightBtn.title = hasTarget ? '' : 'Not reached via Tab \u2014 no position on the focus map';
        }
        if (firstBtn) firstBtn.disabled = index === 0;
        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.disabled = index === panels.length - 1;
        if (lastBtn) lastBtn.disabled = index === panels.length - 1;
      }

      viewer.__klrShowIssue = show;

      if (firstBtn) firstBtn.addEventListener('click', function () { show(0); });
      if (prevBtn) prevBtn.addEventListener('click', function () { show(index - 1); });
      if (nextBtn) nextBtn.addEventListener('click', function () { show(index + 1); });
      if (lastBtn) lastBtn.addEventListener('click', function () { show(panels.length - 1); });

      if (highlightBtn) {
        highlightBtn.addEventListener('click', function () {
          var active = panels[index];
          var targetId = active && active.dataset.markerTarget;
          if (!targetId) return;
          var marker = document.getElementById(targetId);
          if (!marker) return;
          klrScrollTo(marker, 'center');
          marker.focus({ preventScroll: true });
        });
      }

      show(0);
    });

    document.querySelectorAll('.focus-marker--violation[data-selector]').forEach(function (marker) {
      marker.addEventListener('click', function () {
        var selector = marker.dataset.selector;
        var match = null;
        document.querySelectorAll('.issue-instance[data-selector]').forEach(function (inst) {
          if (!match && inst.dataset.selector === selector) match = inst;
        });
        if (!match) return;
        var rule = match.closest('.rule');
        var viewer = match.closest('[data-issue-viewer]');
        var toggle = rule && rule.querySelector('[data-rule-toggle]');
        if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
        if (viewer && viewer.__klrShowIssue) {
          viewer.__klrShowIssue(Number(match.dataset.instanceIndex));
        }
        if (rule) klrScrollTo(rule, 'start');
      });
      marker.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          marker.click();
        }
      });
    });
`;

function COMMON_STYLES(statusKind: Kind): string {
  return `<style>
    :root {
      color-scheme: light dark;

      --klr-background: light-dark(oklch(98.46% 0.0017 247.84deg), oklch(23.28% 0.0218 272.75deg));
      --klr-background-alt: oklch(from var(--klr-background) calc(l + 0.055) c h);
      --klr-border: oklch(from var(--klr-background) calc(l + 0.16) calc(c * 1.3) h);

      --klr-text: oklch(from var(--klr-background) clamp(0, (0.5 - l) * 999, 1) 0 h);
      --klr-text-subtle: color-mix(in oklch, var(--klr-text) 65%, var(--klr-background));
      --klr-text-muted: color-mix(in oklch, var(--klr-text) 45%, var(--klr-background));

      --klr-accent: oklch(54.53% 0.2124 275.85deg);
      --klr-accent-on-bg: color-mix(in oklch, oklch(from var(--klr-accent) l c h) 70%, oklch(from var(--klr-background) clamp(0, calc((0.5 - l) * 1000), 1) none none) 30%);
      --klr-accent-subtle: oklch(from var(--klr-accent) calc(l + 0.2) c h);

      --klr-success: oklch(51.46% 0.1066 163.53deg);
      --klr-success-on-bg: color-mix(in oklch, oklch(from var(--klr-success) l c h) 70%, oklch(from var(--klr-background) clamp(0, calc((0.5 - l) * 1000), 1) none none) 30%);

      --klr-warning: oklch(88.34% 0.1817 99deg);
      --klr-warning-on-bg: color-mix(in oklch, oklch(from var(--klr-warning) l c h) 60%, oklch(from var(--klr-background) clamp(0, calc((0.5 - l) * 1000), 1) none none) 40%);

      --klr-error: oklch(51.01% 0.1951 14.31deg);
      --klr-error-on-bg: color-mix(in oklch, oklch(from var(--klr-error) l c h) 60%, oklch(from var(--klr-background) clamp(0, calc((0.5 - l) * 1000), 1) none none) 40%);
    }

    :root[data-theme="light"] { color-scheme: light; }
    :root[data-theme="dark"] { color-scheme: dark; }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--klr-background); color: var(--klr-text); line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; position: relative; }
    header { margin-bottom: 2rem; }
    .theme-toggle { position: absolute; top: 2rem; right: 2rem; width: 2.25rem; height: 2.25rem; display: flex; align-items: center; justify-content: center; background: var(--klr-background-alt); border: 1px solid var(--klr-border); border-radius: 9999px; color: var(--klr-text); cursor: pointer; }
    .theme-toggle:hover { border-color: var(--klr-accent-on-bg); color: var(--klr-accent-on-bg); }
    h1 { font-size: 1.5rem; color: var(--klr-accent-on-bg); padding-right: 3rem; }
    h1 span { color: var(--klr-text-muted); font-weight: normal; font-size: 0.875rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .meta-card { background: var(--klr-background-alt); padding: 1rem; }
    .meta-card .label { font-size: 0.75rem; color: var(--klr-text-subtle); text-transform: uppercase; letter-spacing: 0.05em; }
    .meta-card .value { font-size: 1.5rem; font-weight: bold; color: var(--klr-text); }
    .status-badge { display: inline-block; padding: 0 0.5rem; border-radius: 0.1rem; font-size: 0.75rem; font-weight: 600; ${badgeStyle(statusKind)} border-style: solid; border-width: 1px; white-space: nowrap; flex-shrink: 0; }
    .rule { background: var(--klr-background-alt); padding: 1.25rem; margin-bottom: 0.75rem; border-left: 3px solid; }
    .rule.passed { border-color: var(--klr-success-on-bg); }
    .rule.failed { border-color: var(--klr-error-on-bg); }
    .rule.warning { border-color: var(--klr-warning-on-bg); }
    .rule.error { border-color: var(--klr-error-on-bg); }
    .rule-header { display: flex; justify-content: start; align-items: center; gap: 0.5rem; }
    .rule-name { font-weight: 600; font-size: 1rem; min-width: 0; display: inline-flex; align-items: center; gap: 0.25rem; }
    button.rule-header { width: 100%; background: none; border: none; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
    .klr-icon { width: 1em; height: 1em; flex-shrink: 0; }
    .icon-status { width: 0.95em; height: 0.95em; }
    .icon-theme { width: 1.1rem; height: 1.1rem; }
    .icon-pager { width: 0.9rem; height: 0.9rem; }
    .rule-chevron { width: 1rem; height: 1rem; color: var(--klr-text-subtle); flex-shrink: 0; transition: transform 0.15s ease; margin-left: auto; }
    .rule-header--toggle[aria-expanded="true"] .rule-chevron { transform: rotate(180deg); }
    .rule-body { margin-top: 0.1rem; }
    .rule-body[hidden] { display: none; }
    .issue-viewer { margin-top: 0.75rem; }
    .issue-instance { display: none; }
    .issue-instance.active { display: block; }
    .issue-pager { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: var(--klr-background); border-radius: 0.1rem; }
    .pager-nav { display: flex; align-items: center; gap: 0.25rem; }
    .pager-count { font-size: 0.9rem; color: var(--klr-text-subtle); padding: 0 0.1rem; white-space: nowrap;     width: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;}
    .pager-btn, .pager-action-btn { background: var(--klr-background-alt); border: 1px solid var(--klr-border); color: var(--klr-text-subtle); border-radius: 0.1rem; padding: 0.5rem 1rem; font-size: 0.8rem; cursor: pointer; line-height: 1; display: inline-flex; align-items: center; gap: 0.25rem; }
    .pager-btn:hover, .pager-action-btn:hover { color: var(--klr-text); border-color: var(--klr-accent-on-bg); }
    .pager-btn:disabled, .pager-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pager-btn:disabled:hover, .pager-action-btn:disabled:hover { color: var(--klr-text-subtle); border-color: var(--klr-border); }
    .pager-actions { display: flex; gap: 0.5rem; }
    .code-block { margin: 0.5rem 0 0; padding: 0.625rem; background: var(--klr-background-alt); border-radius: 0.1rem; font-family: 'SF Mono', monospace; font-size: 0.75rem; color: var(--klr-text-subtle); overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
    .violation { background: var(--klr-background); border-radius: 0.1rem; padding: 1rem; margin-top: 0.75rem; }
    .violation .message { color: var(--klr-text); margin-bottom: 0.5rem; display: flex; align-items: start; justify-content: space-between;}
    .violation .elements { font-family: 'SF Mono', monospace; font-size: 0.8rem; color: var(--klr-text-subtle); overflow-wrap: break-word; word-break: break-all; }
    .violation .element-item { padding: 0.1rem 0.5rem; border-bottom: 1px solid var(--klr-background-alt); }
    .violation .element-item:last-child { border-bottom: none; }
    .violation .element-head { display: flex; align-items: baseline; gap: 0.5rem; }
    .violation .tab-pos { color: var(--klr-accent-on-bg); font-size: 1.2rem; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
    .violation .selector-text { min-width: 0; color: var(--klr-text-subtle); margin-top: 0.125rem; word-break: break-all; }
    .violation details { margin-top: 0.1rem; }
    .violation details summary { cursor: pointer; color: var(--klr-text-muted); font-size: 0.8rem; padding: 0.1rem 0.5rem; }
    .violation details summary:hover { color: var(--klr-text-subtle); }
    .violation .impact { color: var(--klr-text-muted); font-size: 0.8rem; font-style: italic; margin-top: 0.1rem; }
    .violation .wcag-badges { display: flex; flex-wrap: wrap; gap: 0.25rem; min-width: fit-content; }
    .violation .wcag-badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 0.1rem; font-size: 0.75rem; font-weight: 600; ${badgeStyle("accent")} border-style: solid; border-width: 1px; text-decoration: none; }
    .violation .wcag-badge:hover { background: color-mix(in srgb, var(--klr-accent) 20%, transparent); }
    .rule-meta { color: var(--klr-text-subtle); font-size: 0.8rem; margin-top: 0.1rem; }
    .element-name { color: var(--klr-success-on-bg); font-size: 1.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40ch; }
    .violation .fix { background: color-mix(in srgb, var(--klr-accent) 18%, var(--klr-background)); border-radius: 0.1rem; padding: 0.75rem; margin-top: 0.5rem; color: var(--klr-accent-on-bg); font-size: 0.875rem; }
    .focus-map { position: relative; margin: 2rem 0; }
    .focus-map-surface { position: relative; background: var(--klr-background-alt); overflow: hidden; border: 1px solid white;
    outline: 1px solid var(--klr-accent); }
    .focus-map-surface img { width: 100%; display: block; filter: brightness(0.85) saturate(0.9); }
    .focus-map .focus-lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .focus-lines .route { fill: none; stroke: var(--klr-accent); stroke-width: 2; stroke-linecap: round; }
    .focus-lines .route-outline { fill: none; stroke: white; stroke-width: 4; stroke-linecap: round; }
    .focus-lines .route-roving { fill: none; stroke: var(--klr-accent-subtle); stroke-width: 2; stroke-linecap: round; }
    .focus-lines .route-roving-outline { fill: none; stroke: white; stroke-width: 4; stroke-linecap: round; }
    .route-arrow { position: absolute; width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 10px solid var(--klr-accent); z-index: 1; pointer-events: none; height: 13px; }
    .focus-marker { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: var(--klr-accent); border: 1px solid white; color: white; font-size: 0.7rem; font-weight: bold; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); transition: transform 0.12s ease; z-index: 2; cursor: pointer; }
    .focus-marker:hover, .focus-marker:focus { transform: translate(-50%, -50%) scale(1.25); z-index: 3; outline: 1px solid black; }
    .focus-marker.focus-marker--violation { background: var(--klr-warning); color: black; }
    .focus-marker.focus-marker--violation-error { background: var(--klr-error-on-bg); color: white; }
    .focus-marker.focus-marker--roving { width: 30px; height: 30px; border: 1px dashed white; background-color: var(--klr-accent-subtle);}
    .focus-tooltip { position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%) translateY(4px); width: max-content; max-width: 320px; background: var(--klr-background-alt); border: 1px solid var(--klr-border); border-radius: 0.2rem; padding: 0.75rem; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); text-align: left; font-weight: normal; font-size: 0.75rem; line-height: 1.5; color: var(--klr-text-subtle); opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0.12s ease, transform 0.12s ease; z-index: 4; }
    .focus-marker:hover .focus-tooltip, .focus-marker:focus .focus-tooltip { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
    .focus-tooltip-title { color: var(--klr-text); font-weight: 600; font-size: 0.8rem; margin-bottom: 0.1rem; display: flex; justify-content: space-between; gap: 0.75rem; }
    .focus-tooltip-title span { color: var(--klr-text-muted); font-weight: normal; }
    .focus-tooltip-row { display: flex; gap: 0.5rem; padding: 0.125rem 0; }
    .focus-tooltip-row > span:first-child { flex-shrink: 0; color: var(--klr-text-muted); min-width: 6.5rem; }
    .focus-tooltip-value { min-width: 0; word-break: break-all; }
    .focus-tooltip-value--clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .focus-tooltip-value--badges { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .focus-tooltip-value--badges .status-badge { white-space: normal; }
    .tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--klr-border); margin: 1.5rem 0 0; overflow-x: auto; }
    .tab-btn { background: none; border: none; color: var(--klr-text-subtle); padding: 0.75rem 1.25rem; cursor: pointer; font-size: 0.875rem; border-bottom: 2px solid transparent; white-space: nowrap; }
    .tab-btn:hover { color: var(--klr-text); }
    .tab-btn.active { color: var(--klr-accent-on-bg); border-bottom-color: var(--klr-accent-on-bg); }
    .tab-panel { display: none; padding: 1.5rem 0; }
    .tab-panel.active { display: block; }
    footer { border-top: 1px solid var(--klr-border); padding-top: 1rem; margin-top: 2rem; text-align: center; color: var(--klr-text-muted); font-size: 0.8rem; }
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
        <div class="value" style="color: ${crawl.unreachedElements > 0 ? onBgVar("error") : onBgVar("success")}">${crawl.unreachedElements}</div>
      </div>
      <div class="meta-card">
        <div class="label">Errors</div>
        <div class="value" style="color: ${summary.totalErrors > 0 ? onBgVar("error") : onBgVar("success")}">${summary.totalErrors}</div>
      </div>
      <div class="meta-card">
        <div class="label">Warnings</div>
        <div class="value" style="color: ${summary.totalWarnings > 0 ? onBgVar("warning") : onBgVar("success")}">${summary.totalWarnings}</div>
      </div>
      <div class="meta-card">
        <div class="label">Score</div>
        <div class="value" style="color: ${summary.score >= 70 ? onBgVar("success") : summary.score >= 50 ? onBgVar("warning") : onBgVar("error")}">${summary.score}/100${summary.scoreComplete === false ? " (incomplete)" : ""}</div>
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
    <div style="margin: 1rem 0; padding: 0.75rem 1rem; background: var(--klr-background-alt); border-radius: 0.5rem; font-size: 0.85rem; color: var(--klr-text-subtle);">
      ${dismissals ? `<div><strong style="color: var(--klr-text);">Overlays dismissed:</strong> ${dismissals}</div>` : ""}
      ${expansion ? `<div style="margin-top: ${dismissals ? "0.1rem" : "0"};"><strong style="color: var(--klr-text);">Scroll container expanded:</strong> ${expansion}</div>` : ""}
      ${warnings ? `<div style="color: ${onBgVar("warning")}; margin-top: ${dismissals || expansion ? "0.1rem" : "0"};"><strong>Prepare warnings:</strong> ${warnings}</div>` : ""}
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

/**
 * One violation can carry several affected elements — flatten each into its
 * own paginated "instance" (message/wcag/impact/fix repeated per element) so
 * the report can page through them one at a time, axe-DevTools-style.
 * Violations with no specific element (page-level issues like a missing
 * skip link) become a single instance with no selector/code snippet.
 */
interface RuleInstance {
  message: string;
  impact: string;
  wcag?: string[];
  selector?: string;
  outerHTML?: string;
  tabPosition?: number;
  accessibleName?: string;
}

function flattenInstances(
  violations: AuditReport["rules"][number]["violations"],
): RuleInstance[] {
  const instances: RuleInstance[] = [];
  for (const v of violations) {
    if (v.elements.length === 0) {
      instances.push({
        message: v.message,
        impact: v.impact,
        wcag: v.wcag,
      });
      continue;
    }
    for (const el of v.elements) {
      instances.push({
        message: v.message,
        impact: v.impact,
        wcag: v.wcag,
        selector: el.selector,
        outerHTML: el.outerHTML,
        tabPosition: el.tabPosition,
        accessibleName: el.accessibleName,
      });
    }
  }
  return instances;
}

function buildIssueInstanceHTML(
  inst: RuleInstance,
  index: number,
  idPrefix: string,
): string {
  const markerTarget =
    inst.tabPosition != null ? `${idPrefix}marker-${inst.tabPosition}` : "";
  const head =
    inst.tabPosition != null || inst.accessibleName
      ? `<div class="element-head">${inst.tabPosition != null ? `<span class="tab-pos">#${inst.tabPosition}</span>` : ""}${inst.accessibleName ? `<span class="element-name" title="${escapeHTML(inst.accessibleName)}">${escapeHTML(inst.accessibleName)}</span>` : ""}</div>`
      : "";
  const location = inst.selector
    ? `<div class="element-item">
        ${head}
        <div class="selector-text">${escapeHTML(inst.selector)}</div>
      </div>
      ${inst.outerHTML ? `<pre class="code-block"><code>${escapeHTML(inst.outerHTML)}</code></pre>` : ""}`
    : "";

  return `
    <div class="violation issue-instance${index === 0 ? " active" : ""}" data-instance-index="${index}" data-marker-target="${markerTarget}" data-selector="${inst.selector ? escapeHTML(inst.selector) : ""}">
      <div class="message">${escapeHTML(inst.message)} ${buildWcagBadgesHTML(inst.wcag)}</div>
      ${location}
      ${inst.impact ? `<div class="impact">${escapeHTML(inst.impact)}</div>` : ""}
    </div>`;
}

function buildIssueViewerHTML(
  instances: RuleInstance[],
  idPrefix: string,
): string {
  const panels = instances
    .map((inst, i) => buildIssueInstanceHTML(inst, i, idPrefix))
    .join("");
  return `
    <div class="issue-viewer" data-issue-viewer>
      <div class="issue-pager">
        <div class="pager-nav">
          <button type="button" class="pager-btn" data-pager-action="first" aria-label="First issue">${ICON_CARET_TO_LEFT}</button>
          <button type="button" class="pager-btn" data-pager-action="prev" aria-label="Previous issue">${ICON_CARET_LEFT}</button>
          <span class="pager-count"><span data-pager-current>1</span> of <span data-pager-total>${instances.length}</span></span>
          <button type="button" class="pager-btn" data-pager-action="next" aria-label="Next issue">${ICON_CARET_RIGHT}</button>
          <button type="button" class="pager-btn" data-pager-action="last" aria-label="Last issue">${ICON_CARET_TO_RIGHT}</button>
        </div>
        <div class="pager-actions">
          <button type="button" class="pager-action-btn" data-pager-action="highlight">${ICON_TARGET} Highlight</button>
        </div>
      </div>
      ${panels}
    </div>`;
}

function buildRulesHTML(rules: AuditReport["rules"], idPrefix = ""): string {
  return rules
    .map((rule, ruleIdx) => {
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
      const statusKind: Kind =
        status === "passed"
          ? "success"
          : status === "warning"
            ? "warning"
            : "error";
      const instances = flattenInstances(rule.violations);
      const description = rule.ruleDescription
        ? `<div class="rule-meta">${escapeHTML(rule.ruleDescription)}</div>`
        : "";
      const errorNote = rule.error
        ? `<div class="rule-meta">Evaluation error: ${escapeHTML(rule.error.message)}</div>`
        : "";

      if (instances.length === 0) {
        return `
      <div class="rule ${status}">
        <div class="rule-header">
          <span class="rule-name">${rule.passed ? ICON_CHECK : ICON_X} ${escapeHTML(rule.ruleName || rule.ruleId)}</span>
          <span class="status-badge" style="${badgeStyle(statusKind)}">${statusLabel}</span>
        </div>
        ${description}
        ${errorNote}
      </div>`;
      }

      const bodyId = `${idPrefix}rule-${ruleIdx}-body`;
      return `
      <div class="rule ${status}">
        <button type="button" class="rule-header rule-header--toggle" data-rule-toggle aria-expanded="false" aria-controls="${bodyId}">
          <span class="rule-name">${ICON_X} ${escapeHTML(rule.ruleName || rule.ruleId)}</span>
          <span class="status-badge" style="${badgeStyle(statusKind)}">${statusLabel}</span>
          ${ICON_CHEVRON_DOWN}
        </button>
        ${description}
        <div class="rule-body" id="${bodyId}" hidden>
          ${errorNote}
          ${buildIssueViewerHTML(instances, idPrefix)}
        </div>
      </div>`;
    })
    .join("");
}
