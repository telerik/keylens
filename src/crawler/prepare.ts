import type { BrowserContext, Locator, Page } from "playwright";
import type {
  AuditEvent,
  KeylensConfig,
  OverlayDismissal,
  PrepareConfig,
  PrepareConsentPreference,
  PrepareResult,
  PrepareStep,
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

  return { attempted: true, dismissals, warnings, duration };
}
