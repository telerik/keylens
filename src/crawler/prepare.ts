import type { BrowserContext, Locator, Page } from "playwright";
import type {
  AuditEvent,
  KeylensConfig,
  OverlayDismissal,
  PrepareConfig,
  PrepareConsentPreference,
  PrepareResult,
  PrepareStep,
  ScrollContainerExpansion,
} from "../types/index.js";
import { OVERLAY_PRESETS } from "../utils/overlay-presets.js";
import { logger } from "../utils/logger.js";
import {
  createExecutionScope,
  raceWithSignal,
  throwIfAborted,
} from "../utils/execution.js";

const ACTION_PRIORITY: readonly PrepareConsentPreference[] = [
  "reject",
  "accept",
  "close",
];

/** Order in which consent actions are attempted, preferred action first. */
function actionOrder(
  preference: PrepareConsentPreference,
): PrepareConsentPreference[] {
  return [preference, ...ACTION_PRIORITY.filter((a) => a !== preference)];
}

const HEURISTIC_TEXT_PATTERN = "cookie|consent|gdpr|privacy";
const HEURISTIC_BUTTON_PATTERNS: Record<PrepareConsentPreference, string> = {
  reject: "reject|decline|deny|necessary only|only necessary|refuse",
  accept: "accept all|accept|agree|allow all|got it|i understand",
  close: "^(close|dismiss|\\u00d7|x)$",
};

interface FoundControl {
  locator: Locator;
  selector: string;
}

/**
 * Find the first visible element matching any of the given selectors, searching
 * the main frame and all child frames (Sourcepoint-style CMPs live in an iframe).
 */
async function findVisible(
  page: Page,
  selectors: string[] | undefined,
): Promise<FoundControl | undefined> {
  if (!selectors?.length) return undefined;
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      try {
        const locator = frame.locator(selector).first();
        if ((await locator.count()) === 0) continue;
        if (await locator.isVisible()) return { locator, selector };
      } catch {
        // Detached or cross-origin-restricted frame — try the next one.
      }
    }
  }
  return undefined;
}

/** Wait for a dismissed container to disappear, confirming the click had effect. */
async function verifyHidden(
  found: FoundControl,
  timeout = 2000,
): Promise<boolean> {
  try {
    await found.locator.waitFor({ state: "hidden", timeout });
    return true;
  } catch {
    return false;
  }
}

/** Try every built-in CMP preset, in the configured consent preference order. */
async function dismissKnownOverlays(
  page: Page,
  preference: PrepareConsentPreference,
  warnings: string[],
): Promise<OverlayDismissal | undefined> {
  for (const preset of OVERLAY_PRESETS) {
    const container = await findVisible(page, preset.container);
    if (!container) continue;

    for (const action of actionOrder(preference)) {
      const button = await findVisible(page, preset[action]);
      if (!button) continue;
      try {
        await button.locator.click({ timeout: 2000 });
      } catch (error) {
        warnings.push(
          `${preset.provider}: failed to click ${action} button (${(error as Error).message})`,
        );
        continue;
      }
      const verified = await verifyHidden(container);
      return {
        provider: preset.provider,
        action,
        selector: button.selector,
        verified,
      };
    }

    warnings.push(
      `${preset.provider}: banner detected but no dismiss action succeeded`,
    );
    return undefined;
  }
  return undefined;
}

/** Compute a stable CSS selector for an element, used to report what was clicked. */
const UNIQUE_SELECTOR_FN = `function keylensUniqueSelector(el) {
  if (el.id) return '#' + CSS.escape(el.id);
  const parts = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = '#' + CSS.escape(current.id);
      parts.unshift(selector);
      break;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
      if (siblings.length > 1) selector += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}`;

interface HeuristicMatch {
  containerSelector: string;
  buttonSelector: string;
}

/** Raw shape returned by EXPAND_SCROLL_CONTAINER_SCRIPT, before validation. */
interface ScrollContainerExpansionScriptResult {
  selector: string;
  originalHeight: number;
  expandedHeight: number;
  /** True when the expansion had no effect and styles were reverted */
  reverted: boolean;
}

/**
 * Generic fallback for banners not covered by a preset: look for a visible
 * fixed/sticky, high-z-index container whose text mentions cookies/consent, and
 * a button inside it whose label matches the requested consent action.
 */
async function findHeuristicOverlay(
  page: Page,
  buttonPattern: string,
): Promise<HeuristicMatch | undefined> {
  return page.evaluate(
    `(() => {
      ${UNIQUE_SELECTOR_FN}
      const textRe = new RegExp(${JSON.stringify(HEURISTIC_TEXT_PATTERN)}, 'i');
      const buttonRe = new RegExp(${JSON.stringify(buttonPattern)}, 'i');
      const candidates = document.querySelectorAll('body *');
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'sticky') continue;
        const zIndex = parseInt(style.zIndex, 10);
        if (!zIndex || zIndex < 100) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const text = el.textContent || '';
        if (!textRe.test(text)) continue;
        const controls = el.querySelectorAll("button, a[role='button'], [role='button'], input[type='button']");
        for (const control of controls) {
          const label = (control.getAttribute('aria-label') || control.textContent || '').trim();
          if (buttonRe.test(label)) {
            return {
              containerSelector: keylensUniqueSelector(el),
              buttonSelector: keylensUniqueSelector(control),
            };
          }
        }
      }
      return undefined;
    })()`,
  ) as Promise<HeuristicMatch | undefined>;
}

async function dismissHeuristicOverlay(
  page: Page,
  preference: PrepareConsentPreference,
  warnings: string[],
): Promise<OverlayDismissal | undefined> {
  for (const action of actionOrder(preference)) {
    let match: HeuristicMatch | undefined;
    try {
      match = await findHeuristicOverlay(page, HEURISTIC_BUTTON_PATTERNS[action]);
    } catch (error) {
      warnings.push(`Heuristic overlay scan failed: ${(error as Error).message}`);
      return undefined;
    }
    if (!match) continue;

    const container = page.locator(match.containerSelector).first();
    const button = page.locator(match.buttonSelector).first();
    try {
      await button.click({ timeout: 2000 });
    } catch (error) {
      warnings.push(
        `Heuristic overlay: failed to click ${action} button (${(error as Error).message})`,
      );
      continue;
    }
    const verified = await verifyHidden({
      locator: container,
      selector: match.containerSelector,
    });
    return {
      provider: "heuristic",
      action,
      selector: match.buttonSelector,
      verified,
    };
  }
  return undefined;
}

/**
 * Detect a full-page "faux scroll" container — an `overflow: auto/scroll` wrapper
 * that intercepts scrolling instead of the document itself (common in
 * parallax/smooth-scroll page designs, e.g. Locomotive Scroll-style layouts). When
 * the document itself reports no scrollable height, this heuristically picks the
 * largest element that looks like the "real" page (near-full viewport width, near
 * the top, taller than half the viewport) and neutralizes its overflow/height (and
 * any clipping ancestors) so the document expands to the true content length.
 *
 * Verifies the expansion actually grew the document afterwards, and reverts the
 * style changes if it didn't — this can silently fail when the container's content
 * is positioned out of normal flow (`position: absolute`/`fixed` plus a CSS
 * transform), which doesn't contribute to an ancestor's auto height. That pattern
 * shows up in 3D/canvas-like "virtual scroll" scenes (e.g. GSAP ScrollTrigger),
 * where there is no linear stack of content to reveal in the first place.
 */
const EXPAND_SCROLL_CONTAINER_SCRIPT = `(() => {
  ${UNIQUE_SELECTOR_FN}
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const docEl = document.documentElement;

  // Only intervene when the document itself isn't naturally scrollable — a strong
  // signal that a nested container is doing the "real" scrolling instead.
  if (docEl.scrollHeight > viewportH + 100) return null;

  let best = null;
  const candidates = document.querySelectorAll('body *');
  for (const el of candidates) {
    const style = getComputedStyle(el);
    if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
    if (el.scrollHeight <= el.clientHeight + 100) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < viewportW * 0.8) continue;
    if (rect.top > 150 || rect.top < -50) continue;
    if (el.clientHeight < viewportH * 0.5) continue;
    if (!best || el.scrollHeight > best.scrollHeight) best = el;
  }
  if (!best) return null;

  const originalHeight = best.scrollHeight;
  const selector = keylensUniqueSelector(best);

  // Ancestors up to body sometimes clip via a fixed height + overflow: hidden
  // (a "viewport lock" wrapper for the scroll effect) — neutralize those too.
  const targets = [best];
  let ancestor = best.parentElement;
  while (ancestor && ancestor !== document.body) {
    const ancestorStyle = getComputedStyle(ancestor);
    if (ancestorStyle.overflow === 'hidden' || ancestorStyle.overflowY === 'hidden') {
      targets.push(ancestor);
    }
    ancestor = ancestor.parentElement;
  }

  const restore = targets.map((el) => ({
    el,
    overflow: [el.style.getPropertyValue('overflow'), el.style.getPropertyPriority('overflow')],
    overflowY: [el.style.getPropertyValue('overflow-y'), el.style.getPropertyPriority('overflow-y')],
    height: [el.style.getPropertyValue('height'), el.style.getPropertyPriority('height')],
    maxHeight: [el.style.getPropertyValue('max-height'), el.style.getPropertyPriority('max-height')],
  }));

  for (const el of targets) {
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('overflow-y', 'visible', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('max-height', 'none', 'important');
  }

  const expandedHeight = document.documentElement.scrollHeight;

  // Verify the expansion actually took effect. It can silently do nothing when
  // the container's content is out of normal flow (absolutely positioned and/or
  // transformed), in which case revert so the page isn't left half-modified.
  if (expandedHeight <= viewportH + 100) {
    for (const r of restore) {
      r.overflow[0] ? r.el.style.setProperty('overflow', r.overflow[0], r.overflow[1]) : r.el.style.removeProperty('overflow');
      r.overflowY[0] ? r.el.style.setProperty('overflow-y', r.overflowY[0], r.overflowY[1]) : r.el.style.removeProperty('overflow-y');
      r.height[0] ? r.el.style.setProperty('height', r.height[0], r.height[1]) : r.el.style.removeProperty('height');
      r.maxHeight[0] ? r.el.style.setProperty('max-height', r.maxHeight[0], r.maxHeight[1]) : r.el.style.removeProperty('max-height');
    }
    return { selector, originalHeight, expandedHeight, reverted: true };
  }

  return { selector, originalHeight, expandedHeight, reverted: false };
})()`;

async function expandFauxScrollContainer(
  page: Page,
  warnings: string[],
): Promise<ScrollContainerExpansion | undefined> {
  try {
    const result = await page.evaluate(EXPAND_SCROLL_CONTAINER_SCRIPT);
    if (
      !result ||
      typeof result !== "object" ||
      typeof (result as ScrollContainerExpansionScriptResult).selector !==
        "string" ||
      typeof (result as ScrollContainerExpansionScriptResult)
        .originalHeight !== "number" ||
      typeof (result as ScrollContainerExpansionScriptResult)
        .expandedHeight !== "number" ||
      typeof (result as ScrollContainerExpansionScriptResult).reverted !==
        "boolean"
    ) {
      return undefined;
    }
    const { selector, originalHeight, expandedHeight, reverted } =
      result as ScrollContainerExpansionScriptResult;
    if (reverted) {
      warnings.push(
        `Detected a full-page scroll container (${selector}) but could not expand it — its content is likely positioned out of normal document flow (e.g. transform-driven). Page screenshots and the focus map will only reflect the initial viewport.`,
      );
      return undefined;
    }
    return { selector, originalHeight, expandedHeight };
  } catch (error) {
    warnings.push(
      `Scroll container expansion failed: ${(error as Error).message}`,
    );
    return undefined;
  }
}

/** Click each user-supplied selector once, if present on the page. */
async function dismissCustomSelectors(
  page: Page,
  selectors: string[],
  warnings: string[],
): Promise<OverlayDismissal[]> {
  const dismissals: OverlayDismissal[] = [];
  for (const selector of selectors) {
    const found = await findVisible(page, [selector]);
    if (!found) continue;
    try {
      await found.locator.click({ timeout: 2000 });
      dismissals.push({
        provider: "custom",
        action: "custom",
        selector,
        verified: true,
      });
    } catch (error) {
      warnings.push(
        `Custom dismiss selector failed: ${selector} (${(error as Error).message})`,
      );
    }
  }
  return dismissals;
}

async function runPrepareStep(
  page: Page,
  step: PrepareStep,
  warnings: string[],
): Promise<void> {
  switch (step.type) {
    case "click": {
      const found = await findVisible(page, [step.selector]);
      if (!found) {
        if (!step.optional) {
          warnings.push(`Prepare step: click selector not found: ${step.selector}`);
        }
        return;
      }
      try {
        await found.locator.click({ timeout: 2000 });
      } catch (error) {
        if (!step.optional) {
          warnings.push(
            `Prepare step: click failed for ${step.selector} (${(error as Error).message})`,
          );
        }
      }
      return;
    }
    case "press":
      await page.keyboard.press(step.key);
      return;
    case "wait":
      await page.waitForTimeout(step.ms);
      return;
    case "waitFor":
      try {
        await page.waitForSelector(step.selector, {
          timeout: step.timeout ?? 5000,
        });
      } catch (error) {
        warnings.push(
          `Prepare step: waitFor timed out for ${step.selector} (${(error as Error).message})`,
        );
      }
      return;
  }
}

function hasPrepareWork(config: PrepareConfig): boolean {
  return (
    config.dismissOverlays ||
    config.expandScrollContainers ||
    (config.dismissSelectors?.length ?? 0) > 0 ||
    (config.steps?.length ?? 0) > 0
  );
}

function emitOverlayDismissed(
  onEvent: ((event: AuditEvent) => void) | undefined,
  eventStartedAt: number,
  url: string | undefined,
  dismissal: OverlayDismissal,
): void {
  onEvent?.({
    type: "overlay-dismissed",
    phase: "prepare",
    url,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - eventStartedAt,
    provider: dismissal.provider,
    action: dismissal.action,
    selector: dismissal.selector,
    verified: dismissal.verified,
  });
}

/**
 * Apply configured cookies to the browser context before navigation, so
 * cookie-based consent gates never render in the first place.
 */
export async function applyPrepareCookies(
  context: BrowserContext,
  config: KeylensConfig,
  url: string,
): Promise<void> {
  const cookies = config.prepare.cookies;
  if (!cookies?.length) return;
  const hostname = new URL(url).hostname;
  await context.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain ?? hostname,
      path: cookie.path ?? "/",
    })),
  );
}

/**
 * Dismiss cookie/consent banners and run any configured prepare steps, so the
 * tab crawl starts on a clean page. Runs after navigation settles and before
 * capture/crawl. Never throws for ordinary dismissal failures — those degrade
 * to warnings on the returned PrepareResult; only real cancellation (the outer
 * signal aborting) propagates.
 */
export async function preparePage(
  page: Page,
  config: KeylensConfig,
  signal?: AbortSignal,
  url?: string,
  onEvent?: (event: AuditEvent) => void,
  eventStartedAt = Date.now(),
): Promise<PrepareResult> {
  const startTime = Date.now();
  const prepareConfig = config.prepare;
  const dismissals: OverlayDismissal[] = [];
  const warnings: string[] = [];
  let scrollContainerExpanded: ScrollContainerExpansion | undefined;

  if (!hasPrepareWork(prepareConfig)) {
    return { attempted: false, dismissals, warnings, duration: 0 };
  }

  onEvent?.({
    type: "phase-started",
    phase: "prepare",
    url,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - eventStartedAt,
  });

  const scope = createExecutionScope({
    parentSignal: signal,
    timeout: prepareConfig.timeout,
    phase: "prepare",
    url,
  });

  try {
    if (prepareConfig.dismissOverlays) {
      const dismissal = await raceWithSignal(
        dismissKnownOverlays(page, prepareConfig.consentPreference, warnings),
        scope.signal,
        "prepare",
        url,
      );
      const resolvedDismissal =
        dismissal ??
        (await raceWithSignal(
          dismissHeuristicOverlay(
            page,
            prepareConfig.consentPreference,
            warnings,
          ),
          scope.signal,
          "prepare",
          url,
        ));
      if (resolvedDismissal) {
        dismissals.push(resolvedDismissal);
        emitOverlayDismissed(onEvent, eventStartedAt, url, resolvedDismissal);
        logger.debug(
          `Dismissed ${resolvedDismissal.provider} overlay via ${resolvedDismissal.action}`,
        );
      }
    }

    if (prepareConfig.dismissSelectors?.length) {
      const customDismissals = await raceWithSignal(
        dismissCustomSelectors(
          page,
          prepareConfig.dismissSelectors,
          warnings,
        ),
        scope.signal,
        "prepare",
        url,
      );
      for (const dismissal of customDismissals) {
        dismissals.push(dismissal);
        emitOverlayDismissed(onEvent, eventStartedAt, url, dismissal);
      }
    }

    if (prepareConfig.expandScrollContainers) {
      scrollContainerExpanded = await raceWithSignal(
        expandFauxScrollContainer(page, warnings),
        scope.signal,
        "prepare",
        url,
      );
      if (scrollContainerExpanded) {
        logger.debug(
          `Expanded faux-scroll container ${scrollContainerExpanded.selector} to reveal full page height (${scrollContainerExpanded.originalHeight}px -> ${scrollContainerExpanded.expandedHeight}px)`,
        );
      }
    }

    for (const step of prepareConfig.steps ?? []) {
      await raceWithSignal(
        runPrepareStep(page, step, warnings),
        scope.signal,
        "prepare",
        url,
      );
    }
  } catch (error) {
    // Real cancellation (parent signal aborted) must still propagate.
    throwIfAborted(signal, "prepare", url);
    warnings.push(`Prepare phase error: ${(error as Error).message}`);
    logger.debug(`Prepare phase error: ${(error as Error).message}`);
  } finally {
    scope.dispose();
  }

  const duration = Date.now() - startTime;
  onEvent?.({
    type: "phase-completed",
    phase: "prepare",
    url,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - eventStartedAt,
  });

  return { attempted: true, dismissals, warnings, duration, scrollContainerExpanded };
}
