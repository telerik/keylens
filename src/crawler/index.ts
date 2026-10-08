import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "playwright";
import type {
  KeylensConfig,
  CrawlResult,
  FocusedElement,
  FocusStyleSnapshot,
  InteractiveElement,
  InteractionResult,
  BoundingRect,
  SkipLinkResult,
  CaptureSummary,
  AuditAsset,
  AuditEvent,
  InteractionSummary,
  RovingTabindexGroupResult,
} from "../types/index.js";
import {
  SKIP_LINK_PATTERNS,
  MAIN_CONTENT_SELECTORS,
} from "../utils/constants.js";
import { applyPrepareCookies, preparePage } from "./prepare.js";
import {
  getRovingArrowKeys,
  getFallbackArrowKeys,
} from "../utils/aria-orientation.js";
import { hasVisibleFocusChange } from "../utils/focus-style-diff.js";
import { hasVisiblePixelDiff } from "../utils/pixel-diff.js";

/** Shape returned by GET_FOCUSED_ELEMENT_INFO_SCRIPT inside the browser. */
interface FocusedElementInfo {
  selector: string;
  tagName: string;
  role: string;
  accessibleName: string;
  boundingRect: BoundingRect;
  pageRect: BoundingRect;
  tabindexAttr: number | null;
  outerHTML: string;
  ariaAttributes: Record<string, string>;
  parentContext: string | null;
}

import { logger } from "../utils/logger.js";
import {
  GET_FOCUSED_ELEMENT_INFO_SCRIPT,
  GET_INTERACTIVE_ELEMENTS_SCRIPT,
  GET_ACTIVE_ELEMENT_STYLE_SNAPSHOT_SCRIPT,
  GET_STYLE_SNAPSHOT_BY_SELECTOR_SCRIPT,
} from "../utils/selectors.js";
import {
  AuditTimeoutError,
  CrawlError,
  KeylensError,
  NavigationError,
} from "../errors.js";
import {
  createExecutionScope,
  getAbortError,
  raceWithSignal,
  throwIfAborted,
} from "../utils/execution.js";

const BROWSER_LAUNCHERS = {
  chromium,
  firefox,
  webkit,
};

/** Fallback navigation timeout in ms when not configured. */
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

class CaptureBudget {
  readonly summary: CaptureSummary = {
    attempted: 0,
    captured: 0,
    skipped: 0,
    failed: 0,
    byteLength: 0,
    decodedPixels: 0,
  };

  constructor(private readonly config: KeylensConfig["capture"]) {}

  allows(width: number, height: number): boolean {
    this.summary.attempted++;
    const pixels = Math.ceil(width) * Math.ceil(height);
    const { maxDimension, maxPixels } = this.config.limits;
    if (
      width <= 0 ||
      height <= 0 ||
      (maxDimension !== undefined &&
        (width > maxDimension || height > maxDimension)) ||
      (maxPixels !== undefined &&
        this.summary.decodedPixels + pixels > maxPixels)
    ) {
      this.summary.skipped++;
      return false;
    }
    return true;
  }

  accept(buffer: Buffer, width: number, height: number): string | undefined {
    const maxBytes = this.config.limits.maxBytes;
    if (
      maxBytes !== undefined &&
      this.summary.byteLength + buffer.byteLength > maxBytes
    ) {
      this.summary.skipped++;
      return undefined;
    }
    this.summary.captured++;
    this.summary.byteLength += buffer.byteLength;
    this.summary.decodedPixels += Math.ceil(width) * Math.ceil(height);
    return buffer.toString("base64");
  }

  fail(): void {
    this.summary.failed++;
  }

  skip(count = 1): void {
    this.summary.attempted += count;
    this.summary.skipped += count;
  }
}

/**
 * Crawl a URL by tabbing through all focusable elements.
 * Records the complete focus sequence and discovers all interactive elements.
 */
export async function crawlPage(
  url: string,
  config: KeylensConfig,
  signal?: AbortSignal,
  sharedBrowser?: Browser,
  onEvent?: (event: AuditEvent) => void,
  eventStartedAt = Date.now(),
): Promise<CrawlResult> {
  const startTime = Date.now();
  throwIfAborted(signal, "crawl", url);
  logger.info(`Launching ${config.browser} browser...`);

  const ownsBrowser = sharedBrowser === undefined;
  let browser = sharedBrowser;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let abortCleanup: Promise<void> | undefined;
  const captureBudget = new CaptureBudget(config.capture);

  const closeOnAbort = () => {
    if (ownsBrowser && browser) {
      abortCleanup = browser.close().catch(() => undefined);
    } else if (context) {
      abortCleanup = context.close().catch(() => undefined);
    }
  };
  signal?.addEventListener("abort", closeOnAbort, { once: true });

  if (!browser) {
    try {
      browser = await launchAuditBrowser(config, signal, url);
    } catch (error) {
      signal?.removeEventListener("abort", closeOnAbort);
      throw error;
    }
  }

  // Ensure browser cleanup on process termination
  const cleanup = async () => {
    try {
      await browser?.close();
    } catch {
      // Ignore close errors during forced shutdown
    }
  };
  if (ownsBrowser) {
    process.once("SIGINT", cleanup);
    process.once("SIGTERM", cleanup);
  }

  try {
    context = await browser.newContext({
      viewport: config.viewport,
    });
    page = await context.newPage();
    throwIfAborted(signal, "crawl", url);

    // Apply configured cookies before navigation, so cookie-based consent
    // gates never render in the first place.
    await applyPrepareCookies(context, config, url);

    // Dismiss any dialogs (alert/confirm/prompt) that appear during crawling
    page.on("dialog", async (dialog) => {
      logger.warn(`Browser dialog dismissed: "${dialog.message()}"`);
      await dialog.dismiss();
    });

    // Log page JS errors without crashing
    page.on("pageerror", (error) => {
      logger.debug(`Page JS error: ${error.message}`);
    });

    logger.info(`Navigating to ${url}`);
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeout || DEFAULT_NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      throwIfAborted(signal, "navigation", url);
      if (
        (error as Error).name === "TimeoutError" ||
        (error as Error).message.includes("Timeout")
      ) {
        throw new AuditTimeoutError(
          "navigation",
          config.navigationTimeout || DEFAULT_NAVIGATION_TIMEOUT_MS,
          url,
        );
      }
      throw new NavigationError(
        `Failed to navigate to ${url}: ${(error as Error).message}`,
        url,
      );
    }

    // Optional: wait for a specific selector
    if (config.waitForSelector) {
      logger.debug(`Waiting for selector: ${config.waitForSelector}`);
      await page.waitForSelector(config.waitForSelector, {
        timeout: config.tabTimeout,
      });
    }

    // Wait for page to settle
    await page.waitForTimeout(config.waitAfterLoad);
    throwIfAborted(signal, "crawl", url);

    // Dismiss cookie/consent banners and run any configured prepare steps
    // before the page is screenshotted or crawled.
    logger.info("Preparing page...");
    const prepareResult = await preparePage(
      page,
      config,
      signal,
      url,
      onEvent,
      eventStartedAt,
    );
    if (prepareResult.dismissals.length > 0) {
      logger.info(
        `Dismissed ${prepareResult.dismissals.length} overlay(s): ${prepareResult.dismissals.map((d) => d.provider).join(", ")}`,
      );
    }
    if (prepareResult.scrollContainerExpanded) {
      logger.info(
        `Expanded faux-scroll container ${prepareResult.scrollContainerExpanded.selector} (${prepareResult.scrollContainerExpanded.originalHeight}px -> ${prepareResult.scrollContainerExpanded.expandedHeight}px)`,
      );
    }
    for (const warning of prepareResult.warnings) {
      logger.warn(`Prepare: ${warning}`);
    }

    // Capture page dimensions
    const pageDimensions = (await page.evaluate(`(() => {
      return {
        width: Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth),
        height: Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight),
      };
    })()`)) as { width: number; height: number };

    const pageScreenshot = await capturePageScreenshot(
      page,
      config,
      pageDimensions,
      captureBudget,
      signal,
      url,
    );
    if (pageScreenshot) {
      emitAssetCaptured(
        onEvent,
        eventStartedAt,
        url,
        "page-screenshot",
        pageScreenshot,
      );
    }

    // Test skip link functionality (before main tab crawl)
    logger.info("Testing skip link...");
    const skipLinkResult = await testSkipLink(
      page,
      config.tabDelay,
      signal,
      url,
    );
    if (skipLinkResult.found) {
      logger.debug(
        `Skip link ${skipLinkResult.functionWorks ? "works" : "found but does not function correctly"}`,
      );

      // Activating the skip link (Enter press) can leave custom elements/widgets
      // in a mutated state (e.g. a focus-trapping "activated" mode) that would
      // otherwise corrupt the full tab-order crawl below. Reload to a pristine
      // page state before crawling, since only interaction happened above.
      logger.info("Reloading page after skip link test...");
      await page.reload({
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeout || DEFAULT_NAVIGATION_TIMEOUT_MS,
      });
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, {
          timeout: config.tabTimeout,
        });
      }
      await page.waitForTimeout(config.waitAfterLoad);
      throwIfAborted(signal, "crawl", url);
      await preparePage(page, config, signal, url, onEvent, eventStartedAt);
    }

    // Discover all interactive elements
    logger.info("Discovering interactive elements...");
    const interactiveElements = await discoverInteractiveElements(
      page,
      signal,
      url,
    );
    logger.debug(`Found ${interactiveElements.length} interactive elements`);

    // Crawl the tab order
    logger.info("Crawling tab order...");
    const { focusSequence, cycleCompleted } = await crawlTabOrder(
      page,
      config,
      signal,
      url,
      onEvent,
      eventStartedAt,
    );
    logger.debug(
      `Recorded ${focusSequence.length} focused elements, cycle completed: ${cycleCompleted}`,
    );

    // Mark interactive elements that were reached
    markReachedElements(interactiveElements, focusSequence);

    // Post-click interaction testing (if enabled)
    let interactionResults: InteractionResult[] | undefined;
    if (config.interactions.enabled) {
      onEvent?.({
        type: "phase-started",
        phase: "interactions",
        url,
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - eventStartedAt,
      });
      logger.info("Testing post-click interactions...");
      const interactionScope = createExecutionScope({
        parentSignal: signal,
        timeout: config.timeouts.interactions,
        phase: "interactions",
        url,
      });
      try {
        interactionResults = await raceWithSignal(
          crawlInteractions(
            page,
            focusSequence,
            config,
            interactionScope.signal,
            url,
            onEvent,
            eventStartedAt,
          ),
          interactionScope.signal,
          "interactions",
          url,
        );
      } finally {
        interactionScope.dispose();
      }
      logger.debug(
        `Processed ${interactionResults.length} interaction cases, ${interactionResults.filter((result) => result.status === "failed").length} focus issue(s)`,
      );
    }
    const interactionSummary = interactionResults
      ? summarizeInteractions(interactionResults)
      : undefined;

    // Runs last: arrow-key navigation can visibly mutate page state (e.g.
    // switching the active tab panel), so it must not run before phases that
    // depend on a stable page (tab crawl, interactions, screenshots).
    logger.info("Verifying roving-tabindex composite widgets...");
    const rovingTabindexGroups = await verifyRovingTabindexGroups(
      page,
      interactiveElements,
      signal,
      url,
    );

    // Runs after everything else (including roving-tabindex verification,
    // which can itself mutate page state) since it re-focuses individual
    // elements one at a time — nothing downstream depends on tab-order
    // timing being pristine at this point.
    logger.info(
      "Confirming possible missing focus indicators via pixel diff...",
    );
    try {
      await confirmMissingFocusIndicators(
        page,
        focusSequence,
        config,
        signal,
        url,
      );
    } catch (error) {
      throwIfAborted(signal, "crawl", url);
      logger.warn(
        `Focus indicator pixel confirmation pass failed, continuing without it: ${(error as Error).message}`,
      );
    }

    const duration = Date.now() - startTime;
    throwIfAborted(signal, "crawl", url);
    logger.success(`Crawl completed in ${duration}ms`);
    const extracted = extractCapturedAssets(pageScreenshot, focusSequence);
    if (interactionSummary) {
      onEvent?.({
        type: "interaction-completed",
        phase: "interactions",
        url,
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - eventStartedAt,
        attempted: interactionSummary.attempted,
        completed: interactionSummary.attempted,
      });
      onEvent?.({
        type: "phase-completed",
        phase: "interactions",
        url,
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - eventStartedAt,
      });
    }

    return {
      url,
      focusSequence: extracted.focusSequence,
      interactiveElements,
      cycleCompleted,
      pageScreenshotAssetId: extracted.pageScreenshotAssetId,
      assets: extracted.assets,
      crawlDuration: duration,
      pageDimensions,
      skipLinkResult,
      interactionResults,
      interactionSummary,
      prepare: prepareResult,
      capture: captureBudget.summary,
      rovingTabindexGroups,
    };
  } catch (error) {
    throwIfAborted(signal, "crawl", url);
    if (error instanceof KeylensError) throw error;
    throw new CrawlError(`Crawl failed: ${(error as Error).message}`, url, {
      cause: error,
    });
  } finally {
    if (ownsBrowser) {
      process.off("SIGINT", cleanup);
      process.off("SIGTERM", cleanup);
    }
    signal?.removeEventListener("abort", closeOnAbort);
    await abortCleanup;
    page?.removeAllListeners();
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    if (ownsBrowser) {
      await browser?.close().catch(() => undefined);
    }
  }
}

export async function launchAuditBrowser(
  config: KeylensConfig,
  signal?: AbortSignal,
  url?: string,
): Promise<Browser> {
  const launcher = BROWSER_LAUNCHERS[config.browser];
  throwIfAborted(signal, "crawl", url);
  try {
    const launch = launcher.launch({
      headless: !config.headed,
      handleSIGHUP: false,
      handleSIGINT: false,
      handleSIGTERM: false,
    });
    return await raceWithSignal(
      launch.then(async (browser) => {
        if (signal?.aborted) {
          await browser.close().catch(() => undefined);
          throw getAbortError(signal, "crawl", url);
        }
        return browser;
      }),
      signal,
      "crawl",
      url,
    );
  } catch (error) {
    throwIfAborted(signal, "crawl", url);
    const message = (error as Error).message;
    if (
      message.includes("Executable doesn't exist") ||
      message.includes("browserType.launch")
    ) {
      throw new CrawlError(
        `Playwright ${config.browser} browser is not installed. Run: npx playwright install ${config.browser}`,
        url ?? config.url ?? "",
      );
    }
    throw new CrawlError(
      `Failed to launch browser: ${message}`,
      url ?? config.url ?? "",
    );
  }
}

/**
 * Test skip link functionality by tabbing through the first few elements,
 * finding a skip link, pressing Enter, and verifying focus moves to main content.
 */
async function resetSequentialFocus(
  page: Page,
  tabDelay: number,
): Promise<void> {
  await page.evaluate(`(() => {
    const body = document.body;
    const previousTabindex = body.getAttribute("tabindex");
    body.setAttribute("tabindex", "-1");
    body.focus({ preventScroll: true });
    if (previousTabindex === null) {
      body.removeAttribute("tabindex");
    } else {
      body.setAttribute("tabindex", previousTabindex);
    }
    window.scrollTo(0, 0);
  })()`);
  await page.waitForTimeout(tabDelay);
}

/**
 * Iframes cannot be inspected from the top-level document, and tabbing into one
 * can burn many tab presses on internal content we can't see or report on. Remove
 * them from the tab order entirely rather than crawling into them blind.
 */
async function excludeIframesFromTabOrder(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    document.querySelectorAll('iframe').forEach((el) => {
      el.setAttribute('tabindex', '-1');
    });
  })()`);
}

async function testSkipLink(
  page: Page,
  tabDelay: number,
  signal?: AbortSignal,
  url?: string,
): Promise<SkipLinkResult> {
  throwIfAborted(signal, "crawl", url);
  await resetSequentialFocus(page, tabDelay);

  // Tab through first 5 elements looking for a skip link
  for (let i = 0; i < 5; i++) {
    throwIfAborted(signal, "crawl", url);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(tabDelay);

    const elementInfo = (await page.evaluate(
      `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
    )) as FocusedElementInfo | null;

    if (!elementInfo) continue;

    // Check if this element matches a skip link pattern
    const isSkipLink = SKIP_LINK_PATTERNS.some(
      (pattern) =>
        pattern.test(elementInfo.accessibleName) ||
        pattern.test(elementInfo.outerHTML),
    );

    if (!isSkipLink) continue;

    // Found a skip link — press Enter and check where focus moves
    await page.keyboard.press("Enter");
    await page.waitForTimeout(tabDelay * 2);

    // Check if focus moved to a main content target
    const focusTarget = (await page.evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;

      const mainSelectors = ${JSON.stringify(MAIN_CONTENT_SELECTORS)};
      for (const sel of mainSelectors) {
        if (el.matches(sel)) return sel;
      }
      // Check if focus moved to an element inside main content
      for (const sel of mainSelectors) {
        const main = document.querySelector(sel);
        if (main && main.contains(el)) return sel + ' (child)';
      }

      // Check if focus target has an ID that the skip link points to
      if (el.id) return '#' + el.id;
      return el.tagName.toLowerCase();
    })()`)) as string | null;

    const functionWorks = focusTarget !== null;

    await resetSequentialFocus(page, tabDelay);

    return {
      found: true,
      element: {
        selector: elementInfo.selector,
        accessibleName: elementInfo.accessibleName,
        outerHTML: elementInfo.outerHTML,
      },
      functionWorks,
      focusTarget: focusTarget ?? undefined,
    };
  }

  await resetSequentialFocus(page, tabDelay);

  return { found: false, functionWorks: false };
}

async function capturePageScreenshot(
  page: Page,
  config: KeylensConfig,
  pageDimensions: { width: number; height: number },
  budget: CaptureBudget,
  signal?: AbortSignal,
  url?: string,
): Promise<string | undefined> {
  if (config.capture.page === "none") return undefined;
  throwIfAborted(signal, "capture", url);

  const fullPage = config.capture.page === "full";
  const dimensions = fullPage ? pageDimensions : config.viewport;
  if (!budget.allows(dimensions.width, dimensions.height)) {
    logger.warn(
      `Skipped ${config.capture.page} page screenshot because it exceeds capture limits`,
    );
    return undefined;
  }

  try {
    logger.info(`Capturing ${config.capture.page} page screenshot...`);
    const buffer = await page.screenshot({ fullPage, type: "png" });
    const data = budget.accept(buffer, dimensions.width, dimensions.height);
    if (!data) {
      logger.warn("Skipped page screenshot because it exceeds maxBytes");
    }
    return data;
  } catch {
    throwIfAborted(signal, "capture", url);
    budget.fail();
    logger.warn("Page screenshot capture failed; continuing without it");
    return undefined;
  }
}

/**
 * Tab through the page and record each focused element.
 */
function emitAssetCaptured(
  onEvent: ((event: AuditEvent) => void) | undefined,
  eventStartedAt: number,
  url: string | undefined,
  assetType: AuditAsset["type"],
  data: string,
): void {
  onEvent?.({
    type: "asset-captured",
    phase: "capture",
    url,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - eventStartedAt,
    assetType,
    byteLength: Buffer.byteLength(data, "base64"),
  });
}

function emitCrawlProgress(
  onEvent: ((event: AuditEvent) => void) | undefined,
  eventStartedAt: number,
  url: string | undefined,
  tabsAttempted: number,
  maxTabs: number,
  elementsFocused: number,
): void {
  onEvent?.({
    type: "crawl-progress",
    phase: "crawl",
    url,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - eventStartedAt,
    tabsAttempted,
    maxTabs,
    elementsFocused,
  });
}

async function crawlTabOrder(
  page: Page,
  config: KeylensConfig,
  signal?: AbortSignal,
  url?: string,
  onEvent?: (event: AuditEvent) => void,
  eventStartedAt = Date.now(),
): Promise<{
  focusSequence: FocusedElement[];
  cycleCompleted: boolean;
}> {
  const focusSequence: FocusedElement[] = [];
  let cycleCompleted = false;
  let firstSelector: string | null = null;
  let focusLeftSinceLastStop = false;
  const tabDelay = config.tabDelay;

  await resetSequentialFocus(page, tabDelay);
  await excludeIframesFromTabOrder(page);

  for (let i = 0; i < config.maxTabs; i++) {
    throwIfAborted(signal, "crawl", url);
    // Press Tab with timeout protection
    try {
      await Promise.race([
        (async () => {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(tabDelay);
        })(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Tab press timed out")),
            config.tabTimeout,
          ),
        ),
      ]);
    } catch {
      throwIfAborted(signal, "crawl", url);
      logger.warn(`Tab press ${i + 1} timed out, skipping`);
      emitCrawlProgress(
        onEvent,
        eventStartedAt,
        url,
        i + 1,
        config.maxTabs,
        focusSequence.length,
      );
      continue;
    }

    // Get info about the currently focused element
    const elementInfo = (await page.evaluate(
      `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
    )) as FocusedElementInfo | null;

    if (!elementInfo) {
      // Focus is on body or document — may indicate end of cycle
      focusLeftSinceLastStop = true;
      emitCrawlProgress(
        onEvent,
        eventStartedAt,
        url,
        i + 1,
        config.maxTabs,
        focusSequence.length,
      );
      continue;
    }

    // Check if we've cycled back to the first element. An immediate repeat of
    // the element that already holds focus is a trap, not a completed cycle.
    const previousElement = focusSequence[focusSequence.length - 1];
    const repeatsPreviousStop =
      previousElement !== undefined &&
      previousElement.selector === elementInfo.selector &&
      !focusLeftSinceLastStop;
    focusLeftSinceLastStop = false;
    if (firstSelector === null) {
      firstSelector = elementInfo.selector;
    } else if (elementInfo.selector === firstSelector && !repeatsPreviousStop) {
      cycleCompleted = true;
      emitCrawlProgress(
        onEvent,
        eventStartedAt,
        url,
        i + 1,
        config.maxTabs,
        focusSequence.length,
      );
      break;
    }

    // Check for duplicate (same element focused twice in a row = possible trap)
    const lastElement = focusSequence[focusSequence.length - 1];
    if (lastElement && lastElement.selector === elementInfo.selector) {
      // Same element focused again — could be a trap, record it
      logger.debug(`Possible trap at: ${elementInfo.selector}`);
    }

    // Check if element is obscured by other content (WCAG 2.4.11)
    let isObscured = false;
    try {
      isObscured = await page.evaluate(`(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const topEl = document.elementFromPoint(centerX, centerY);
        if (!topEl) return false;
        return topEl !== el && !el.contains(topEl) && !topEl.contains(el);
      })()`);
    } catch {
      throwIfAborted(signal, "crawl", url);
      // If the check fails, assume not obscured
    }

    // Capture a computed-style snapshot while the element is focused (always —
    // cheap style reads, no images). Diffed against the unfocused snapshot
    // below by the missing-focus-indicator rule.
    let focusedStyleSnapshot: FocusStyleSnapshot | undefined;
    try {
      focusedStyleSnapshot =
        (await page.evaluate(
          `(${GET_ACTIVE_ELEMENT_STYLE_SNAPSHOT_SCRIPT})()`,
        )) ?? undefined;
    } catch {
      throwIfAborted(signal, "capture", url);
      // Ignore style capture failures
    }

    // The previous element just lost focus — re-locate it by selector (it's no
    // longer document.activeElement) and snapshot its unfocused style.
    if (lastElement && !lastElement.unfocusedStyleSnapshot) {
      try {
        lastElement.unfocusedStyleSnapshot =
          (await page.evaluate(
            `(${GET_STYLE_SNAPSHOT_BY_SELECTOR_SCRIPT})(${JSON.stringify(lastElement.selector)})`,
          )) ?? undefined;
      } catch {
        throwIfAborted(signal, "capture", url);
      }
    }

    const focusedElement: FocusedElement = {
      tabIndex: focusSequence.length + 1,
      selector: elementInfo.selector,
      tagName: elementInfo.tagName,
      role: elementInfo.role,
      accessibleName: elementInfo.accessibleName,
      boundingRect: elementInfo.boundingRect,
      pageRect: elementInfo.pageRect,
      tabindexAttr: elementInfo.tabindexAttr,
      hasFocusIndicator: null, // Will be determined by focus indicator rule
      isObscured,
      focusedStyleSnapshot,
      outerHTML: elementInfo.outerHTML,
      ariaAttributes:
        Object.keys(elementInfo.ariaAttributes).length > 0
          ? elementInfo.ariaAttributes
          : undefined,
      parentContext: elementInfo.parentContext ?? undefined,
    };

    focusSequence.push(focusedElement);
    emitCrawlProgress(
      onEvent,
      eventStartedAt,
      url,
      i + 1,
      config.maxTabs,
      focusSequence.length,
    );
  }

  // Capture unfocused style snapshot of the last element (it just lost focus when cycle ends)
  if (focusSequence.length > 0) {
    const lastEl = focusSequence[focusSequence.length - 1];
    if (!lastEl.unfocusedStyleSnapshot) {
      // Tab once more so the last element loses focus
      await page.keyboard.press("Tab");
      await page.waitForTimeout(tabDelay);

      try {
        lastEl.unfocusedStyleSnapshot =
          (await page.evaluate(
            `(${GET_STYLE_SNAPSHOT_BY_SELECTOR_SCRIPT})(${JSON.stringify(lastEl.selector)})`,
          )) ?? undefined;
      } catch {
        throwIfAborted(signal, "capture", url);
      }
    }
  }

  return { focusSequence, cycleCompleted };
}

function extractCapturedAssets(
  pageScreenshot: string | undefined,
  focusSequence: FocusedElement[],
): {
  assets: AuditAsset[];
  pageScreenshotAssetId?: string;
  focusSequence: FocusedElement[];
} {
  const assets: AuditAsset[] = [];
  const pageScreenshotAssetId = pageScreenshot
    ? (() => {
        const id = "page-screenshot";
        assets.push({
          id,
          type: "page-screenshot",
          mediaType: "image/png",
          byteLength: Buffer.byteLength(pageScreenshot, "base64"),
          storage: { kind: "inline", data: pageScreenshot, encoding: "base64" },
        });
        return id;
      })()
    : undefined;

  return {
    assets,
    pageScreenshotAssetId,
    focusSequence,
  };
}

/** Max elements to re-verify via screenshot in the missing-focus-indicator confirmation pass. */
const PIXEL_CONFIRMATION_MAX_ELEMENTS = 30;

/** Padding (px) around the live bounding box when clipping confirmation screenshots. */
const PIXEL_CONFIRMATION_PADDING = 20;

/**
 * Captures a screenshot of an element's *current* bounding box, scrolled into
 * view and measured fresh at capture time (never a stale pageRect from
 * earlier in the crawl) — so it stays correct regardless of how much the
 * page has scrolled since the main tab crawl finished.
 */
async function captureLiveElementScreenshot(
  page: Page,
  selector: string,
): Promise<Buffer | undefined> {
  try {
    const locator = page.locator(selector).first();
    await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
    const box = await locator.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) return undefined;
    const clip = {
      x: Math.max(0, box.x - PIXEL_CONFIRMATION_PADDING),
      y: Math.max(0, box.y - PIXEL_CONFIRMATION_PADDING),
      width: box.width + PIXEL_CONFIRMATION_PADDING * 2,
      height: box.height + PIXEL_CONFIRMATION_PADDING * 2,
    };
    return await page.screenshot({ clip, type: "png" });
  } catch {
    return undefined;
  }
}

/**
 * Screenshot-based second opinion for missing-focus-indicator candidates:
 * elements whose computed-style diff (self/pseudo-elements/ancestors/
 * descendants) found no change at all. Some real indicators live outside
 * every DOM relationship the style diff checks — a focus ring drawn inside a
 * `<canvas>` bitmap by page JS, or styling applied via a sibling/portaled
 * element — so a screenshot pixel-diff is the only way to see them.
 *
 * Re-focuses each candidate individually (by selector) and pixel-diffs a
 * padded screenshot of its focused vs. blurred state via pixelmatch. Capped
 * to PIXEL_CONFIRMATION_MAX_ELEMENTS since it's a targeted confirmation pass
 * over already-suspected violations, not a blanket per-element cost.
 */
async function confirmMissingFocusIndicators(
  page: Page,
  focusSequence: FocusedElement[],
  config: KeylensConfig,
  signal?: AbortSignal,
  url?: string,
): Promise<void> {
  const candidates = focusSequence.filter(
    (el) =>
      el.focusedStyleSnapshot &&
      el.unfocusedStyleSnapshot &&
      !hasVisibleFocusChange(
        el.focusedStyleSnapshot,
        el.unfocusedStyleSnapshot,
      ),
  );
  if (candidates.length === 0) return;

  const capped = candidates.slice(0, PIXEL_CONFIRMATION_MAX_ELEMENTS);
  logger.debug(
    `Confirming ${capped.length} of ${candidates.length} possible missing focus indicator(s) via screenshot diff`,
  );

  for (const el of capped) {
    throwIfAborted(signal, "crawl", url);
    try {
      await page.locator(el.selector).first().focus({ timeout: 2000 });
      const focusedShot = await captureLiveElementScreenshot(page, el.selector);
      if (!focusedShot) continue;

      await page.evaluate(
        `(() => { const target = document.querySelector(${JSON.stringify(el.selector)}); if (target) target.blur(); })()`,
      );
      await page.waitForTimeout(config.tabDelay);
      const unfocusedShot = await captureLiveElementScreenshot(
        page,
        el.selector,
      );
      if (!unfocusedShot) continue;

      el.focusIndicatorPixelConfirmed = hasVisiblePixelDiff(
        focusedShot,
        unfocusedShot,
      );
    } catch {
      throwIfAborted(signal, "crawl", url);
      logger.debug(
        `Focus indicator pixel confirmation failed for ${el.selector}`,
      );
    }
  }
}

/**
 * Discover all interactive elements on the page.
 */
async function discoverInteractiveElements(
  page: Page,
  signal?: AbortSignal,
  url?: string,
): Promise<InteractiveElement[]> {
  throwIfAborted(signal, "crawl", url);
  const result = await page.evaluate(`(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`);
  throwIfAborted(signal, "crawl", url);
  return (result ?? []) as InteractiveElement[];
}

const DESTRUCTIVE_CONTROL_PATTERN =
  /\b(delete|remove|destroy|purchase|buy|pay|checkout|submit order|sign out|log out)\b/i;

function interactionElement(
  element: FocusedElement,
): InteractionResult["element"] {
  return {
    selector: element.selector,
    tagName: element.tagName,
    role: element.role,
    accessibleName: element.accessibleName,
  };
}

function isInteractionCandidate(element: FocusedElement): boolean {
  if (element.tagName === "button" || element.role === "button") return true;
  if (element.tagName !== "input") return false;
  const type = /type=["']?([^"'\s>]+)/i
    .exec(element.outerHTML)?.[1]
    ?.toLowerCase();
  return ["button", "checkbox", "radio"].includes(type ?? "");
}

async function matchesAnySelector(
  page: Page,
  element: FocusedElement,
  filters: string[] | undefined,
): Promise<boolean> {
  if (!filters?.length) return false;
  const locator = await resolveInteractionLocator(page, element);
  if ((await locator.count()) === 0) return false;
  return locatorMatchesAnySelector(locator, filters);
}

async function locatorMatchesAnySelector(
  locator: Locator,
  filters: string[] | undefined,
): Promise<boolean> {
  if (!filters?.length) return false;
  return locator.evaluate(
    (element, selectors) =>
      selectors.some((candidate) => element.matches(candidate)),
    filters,
  );
}

async function isDestructiveControl(
  locator: Locator,
  accessibleName: string,
): Promise<boolean> {
  const currentLabel = await locator.evaluate((element) => {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("value"),
      element.textContent,
    ]
      .filter(Boolean)
      .join(" ");
  });
  return DESTRUCTIVE_CONTROL_PATTERN.test(`${accessibleName} ${currentLabel}`);
}

async function resolveInteractionLocator(
  page: Page,
  element: FocusedElement,
): Promise<Locator> {
  const selectorMatch = page.locator(element.selector).first();
  if ((await selectorMatch.count()) > 0) return selectorMatch;
  if (element.accessibleName) {
    return page
      .getByRole(element.role as "button" | "checkbox" | "radio", {
        name: element.accessibleName,
        exact: true,
      })
      .first();
  }
  return selectorMatch;
}

async function resetInteractionPage(
  page: Page,
  config: KeylensConfig,
  url: string,
  signal?: AbortSignal,
): Promise<void> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeout,
  });
  if (config.waitForSelector) {
    await page.waitForSelector(config.waitForSelector, {
      timeout: config.navigationTimeout,
    });
  }
  if (config.waitAfterLoad > 0) {
    await page.waitForTimeout(config.waitAfterLoad);
  }
  // Reloading brings the consent banner back — dismiss it again so
  // interaction cases run against the same clean page as the tab crawl.
  // No onEvent here: this is a background repeat within the interactions
  // phase, not a top-level prepare phase worth reporting again.
  await preparePage(page, config, signal, url);
}

function summarizeInteractions(
  results: InteractionResult[],
): InteractionSummary {
  return {
    total: results.length,
    attempted: results.filter(
      (result) =>
        result.status !== "skipped" || result.reason === "navigation-blocked",
    ).length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    errors: results.filter((result) => result.status === "error").length,
  };
}

async function crawlInteractions(
  page: Page,
  focusSequence: FocusedElement[],
  config: KeylensConfig,
  signal?: AbortSignal,
  url?: string,
  onEvent?: (event: AuditEvent) => void,
  eventStartedAt = Date.now(),
): Promise<InteractionResult[]> {
  const results: InteractionResult[] = [];
  const interactions = config.interactions;
  const targetUrl = url ?? page.url();
  let attempted = 0;
  let completed = 0;
  const record = (result: InteractionResult) => {
    results.push(result);
    const consumedBudget =
      result.status !== "skipped" || result.reason === "navigation-blocked";
    if (consumedBudget) {
      completed++;
      onEvent?.({
        type: "interaction-progress",
        phase: "interactions",
        url,
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - eventStartedAt,
        attempted,
        completed,
        maxCases: interactions.maxCases,
      });
    }
  };
  const candidates: FocusedElement[] = [];
  for (const element of focusSequence.filter(isInteractionCandidate)) {
    if (
      interactions.include?.length &&
      !(await matchesAnySelector(page, element, interactions.include))
    ) {
      continue;
    }
    candidates.push(element);
  }

  for (const element of candidates) {
    throwIfAborted(signal, "interactions", url);

    for (const action of interactions.actions) {
      const startedAt = Date.now();
      const base = {
        element: interactionElement(element),
        action,
        focusAfter: null,
      };
      if (attempted >= interactions.maxCases) {
        record({
          ...base,
          status: "skipped",
          reason: "limit-reached",
          message: `Interaction case limit of ${interactions.maxCases} reached`,
          duration: Date.now() - startedAt,
        });
        continue;
      }
      attempted++;

      let navigationBlocked = false;
      const blockNavigation = async (route: Route) => {
        if (
          route.request().isNavigationRequest() &&
          route.request().frame() === page.mainFrame()
        ) {
          navigationBlocked = true;
          await route.abort("blockedbyclient");
        } else {
          await route.continue();
        }
      };

      try {
        if (interactions.isolation === "reload") {
          await resetInteractionPage(page, config, targetUrl, signal);
        }
        const locator = await resolveInteractionLocator(page, element);
        if ((await locator.count()) === 0) {
          record({
            ...base,
            status: "error",
            reason: "element-missing",
            message: `Control no longer exists after page reset: ${element.selector}`,
            duration: Date.now() - startedAt,
          });
          continue;
        }
        if (
          interactions.include?.length &&
          !(await locatorMatchesAnySelector(locator, interactions.include))
        ) {
          attempted--;
          record({
            ...base,
            status: "skipped",
            reason: "excluded",
            message: `Control no longer matches the interaction selector policy: ${element.selector}`,
            duration: Date.now() - startedAt,
          });
          continue;
        }
        if (await locatorMatchesAnySelector(locator, interactions.exclude)) {
          attempted--;
          record({
            ...base,
            status: "skipped",
            reason: "excluded",
            message: `Excluded by interaction selector policy: ${element.selector}`,
            duration: Date.now() - startedAt,
          });
          continue;
        }
        if (
          interactions.excludeDestructive &&
          (await isDestructiveControl(locator, element.accessibleName))
        ) {
          attempted--;
          record({
            ...base,
            status: "skipped",
            reason: "destructive",
            message: `Potentially destructive control was not activated: ${element.selector}`,
            duration: Date.now() - startedAt,
          });
          continue;
        }
        if (interactions.navigation === "block") {
          await page.route("**/*", blockNavigation);
        }

        await locator.focus({ timeout: interactions.timeout });
        if (action === "click") {
          await locator.click({
            timeout: interactions.timeout,
            noWaitAfter: true,
          });
        } else {
          await locator.press(action === "enter" ? "Enter" : " ", {
            timeout: interactions.timeout,
            noWaitAfter: true,
          });
        }
        await page.waitForTimeout(Math.min(config.tabDelay * 2, 500));
        throwIfAborted(signal, "interactions", url);

        if (navigationBlocked) {
          record({
            ...base,
            status: "skipped",
            reason: "navigation-blocked",
            message: `Top-level navigation was blocked after ${action} on ${element.selector}`,
            duration: Date.now() - startedAt,
          });
          continue;
        }

        const focusInfo = (await page.evaluate(
          `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
        )) as FocusedElementInfo | null;
        const focusAfter = focusInfo
          ? {
              selector: focusInfo.selector,
              tagName: focusInfo.tagName,
              role: focusInfo.role,
            }
          : null;
        const focusState = focusAfter
          ? ((await page.evaluate(`(() => {
              const element = document.activeElement;
              if (!element || element === document.body) return null;
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              const visible =
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== "hidden" &&
                style.display !== "none";
              const interactive = element.matches(
                'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable="true"],[role="button"],[role="menuitem"],[role="option"],[role="tab"]'
              );
              const role = element.getAttribute('role');
              const managed =
               element.hasAttribute('tabindex') ||
               role === 'dialog' ||
               role === 'alertdialog';
              return { visible, interactive, managed };
            })()`)) as {
              visible: boolean;
              interactive: boolean;
              managed: boolean;
            } | null)
          : null;
        const sameControl = focusAfter?.selector === element.selector;
        const validMovedFocus =
          focusState?.visible === true &&
          (focusState.interactive === true || focusState.managed === true);
        const status = sameControl || validMovedFocus ? "passed" : "failed";
        const reason = sameControl
          ? "focus-preserved"
          : validMovedFocus
            ? "focus-moved"
            : focusAfter
              ? "unexpected-focus"
              : "focus-lost";
        record({
          ...base,
          focusAfter,
          status,
          reason,
          message:
            status === "failed"
              ? `Focus became invalid after ${action} on ${element.selector}`
              : undefined,
          duration: Date.now() - startedAt,
        });
      } catch (error) {
        throwIfAborted(signal, "interactions", url);
        record({
          ...base,
          status: "error",
          reason: "action-failed",
          message: `Interaction failed for ${element.selector}: ${(error as Error).message}`,
          duration: Date.now() - startedAt,
        });
      } finally {
        if (interactions.navigation === "block") {
          await page.unroute("**/*", blockNavigation).catch(() => undefined);
        }
      }
    }
  }

  return results;
}

/**
 * Cross-reference the focus sequence with interactive elements
 * to mark which ones were reached.
 */
export function markReachedElements(
  interactiveElements: InteractiveElement[],
  focusSequence: FocusedElement[],
): void {
  const reachedSelectors = new Set(focusSequence.map((el) => el.selector));

  for (const element of interactiveElements) {
    element.reached = reachedSelectors.has(element.selector);
  }
}

/**
 * Floor for arrow-key presses attempted per key when verifying a single
 * roving-tabindex group. The effective cap scales up to the group's member
 * count so a single-key sweep can traverse every member from any starting
 * position, however far the active member is from either end.
 */
const ROVING_TABINDEX_MIN_PRESSES = 50;

/**
 * Verifies that every member of each roving-tabindex composite widget (e.g. a
 * tablist) is actually reachable via arrow keys from the active member, not
 * just structurally declared via tabindex="-1" markup.
 *
 * Runs as the LAST crawl phase (after tab crawl and interactions) because
 * arrow-key navigation can visibly change page state (e.g. switching the
 * active tab panel in an "automatic activation" tabs widget), which would
 * otherwise corrupt subsequent phases that depend on a stable page.
 */
// A member is a real Tab stop only with an explicit non-negative tabindex.
// `tabindexAttr` is `null` when the attribute is absent entirely (common for
// container-retains-focus widgets, e.g. a Kendo Calendar's day cells) -
// treating null as "not -1" would wrongly pick such a member as focusable.
export function isRealTabStop(tabindexAttr: number | null): boolean {
  return tabindexAttr !== null && tabindexAttr !== -1;
}

async function verifyRovingTabindexGroups(
  page: Page,
  interactiveElements: InteractiveElement[],
  signal?: AbortSignal,
  url?: string,
): Promise<RovingTabindexGroupResult[]> {
  const groups = new Map<string, InteractiveElement[]>();
  for (const el of interactiveElements) {
    if (!el.rovingContainerSelector) continue;
    const members = groups.get(el.rovingContainerSelector) ?? [];
    members.push(el);
    groups.set(el.rovingContainerSelector, members);
  }

  // Some pages split ONE logical roving-tabindex widget across multiple
  // sibling ARIA containers (e.g. a `role="grid"` per visual category) that
  // share a single active/Tab-reachable member across the whole set - arrow
  // keys flow seamlessly from the last member of one container into the
  // first member of the next. A container with no active member of its own
  // can't be verified independently (no entry point to focus first); if
  // exactly one OTHER container sharing the same member role DOES have one,
  // merge them so the whole shared domain is verified together instead of
  // silently skipping the orphaned containers.
  const containersByMemberRole = new Map<
    string,
    Array<[selector: string, members: InteractiveElement[]]>
  >();
  for (const entry of groups) {
    const [, members] = entry;
    const role = members[0]?.role ?? "";
    const entries = containersByMemberRole.get(role) ?? [];
    entries.push(entry);
    containersByMemberRole.set(role, entries);
  }
  for (const entries of containersByMemberRole.values()) {
    const hosts = entries.filter(([, members]) =>
      members.some((el) => isRealTabStop(el.tabindexAttr)),
    );
    const orphans = entries.filter(
      ([, members]) => !members.some((el) => isRealTabStop(el.tabindexAttr)),
    );
    if (hosts.length === 1 && orphans.length > 0) {
      const [, hostMembers] = hosts[0];
      for (const [orphanSelector, orphanMembers] of orphans) {
        hostMembers.push(...orphanMembers);
        groups.delete(orphanSelector);
      }
    }
  }

  const results: RovingTabindexGroupResult[] = [];

  for (const [containerSelector, members] of groups) {
    throwIfAborted(signal, "crawl", url);
    if (members.length < 2) continue;
    // If no member has tabindex="-1", this isn't the "one active, rest -1"
    // roving-tabindex pattern at all - it's a list where every member is
    // already its own independent Tab stop (e.g. a Kendo drawer nav or a
    // chip/tag list with tabindex="0" on every item). Arrow-key navigation
    // was never required for these to be fully keyboard-reachable.
    if (!members.some((el) => el.tabindexAttr === -1)) continue;

    try {
      const containerLocator = page.locator(containerSelector).first();
      if ((await containerLocator.count()) === 0) continue;
      const containerRole = (await containerLocator.getAttribute("role")) ?? "";
      const ariaOrientation =
        await containerLocator.getAttribute("aria-orientation");

      // The active member is the one that's a real Tab stop; that's the entry
      // point a keyboard user actually lands on. If NO member is a Tab stop,
      // this isn't the per-member roving-tabindex pattern at all (e.g. some
      // widgets keep real DOM focus on the container itself and move an
      // internal highlight via arrow keys instead) - skip rather than force-
      // focus an arbitrary member, which wouldn't reflect real keyboard use and
      // would produce a misleading "broken" result.
      const activeMember = members.find((el) => isRealTabStop(el.tabindexAttr));
      if (!activeMember) continue;
      const activeLocator = page.locator(activeMember.selector).first();
      if ((await activeLocator.count()) === 0) continue;
      await activeLocator.focus();

      const memberSelectors = new Set(members.map((el) => el.selector));
      const maxPresses = Math.max(members.length, ROVING_TABINDEX_MIN_PRESSES);
      // Capture each reached member's live page-relative rect (not the
      // viewport-relative rect from initial discovery) so reports can plot
      // these as focus-map markers regardless of scroll position.
      const reached = new Map<string, BoundingRect>();
      const activeInfo = (await page.evaluate(
        `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
      )) as FocusedElementInfo | null;
      if (activeInfo && memberSelectors.has(activeInfo.selector)) {
        reached.set(activeInfo.selector, activeInfo.pageRect);
      }

      const primary = getRovingArrowKeys(containerRole, ariaOrientation);
      const fallback = getFallbackArrowKeys(primary);
      // Each key is tried as its own complete sweep from the active member,
      // never combined with another key in the same press: a 2D widget (e.g.
      // a grid that responds to both ArrowRight AND ArrowDown) would otherwise
      // move along both axes on every iteration, overshooting and skipping
      // members that a real user pressing just one arrow key would reach.
      const keyAttempts = [
        ...primary.forward,
        ...primary.backward,
        ...fallback.forward,
        ...fallback.backward,
      ];

      for (const key of keyAttempts) {
        if (reached.size === memberSelectors.size) break;
        await activeLocator.focus();
        for (
          let i = 0;
          i < maxPresses && reached.size < memberSelectors.size;
          i++
        ) {
          await page.keyboard.press(key);
          const info = (await page.evaluate(
            `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
          )) as FocusedElementInfo | null;
          if (info && memberSelectors.has(info.selector)) {
            reached.set(info.selector, info.pageRect);
          }
        }
      }

      const unreached = members
        .map((el) => el.selector)
        .filter((selector) => !reached.has(selector));

      results.push({
        containerSelector,
        containerRole,
        totalMembers: members.length,
        reachedViaArrowKeys: [...reached].map(([selector, pageRect]) => ({
          selector,
          pageRect,
        })),
        unreachedViaArrowKeys: unreached,
      });
    } catch {
      throwIfAborted(signal, "crawl", url);
      logger.debug(
        `Roving-tabindex verification failed for container: ${containerSelector}`,
      );
    }
  }

  return results;
}
