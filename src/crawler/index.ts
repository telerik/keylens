import { chromium, firefox, webkit, type Browser, type Page } from "playwright";
import type {
  KeylensConfig,
  CrawlResult,
  FocusedElement,
  InteractiveElement,
  InteractionResult,
  BoundingRect,
  SkipLinkResult,
} from "../types/index.js";
import {
  SKIP_LINK_PATTERNS,
  MAIN_CONTENT_SELECTORS,
} from "../utils/constants.js";

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
} from "../utils/selectors.js";
import { CrawlError, NavigationError } from "../errors.js";

const BROWSER_LAUNCHERS = {
  chromium,
  firefox,
  webkit,
};

/** Fallback navigation timeout in ms when not configured. */
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

/**
 * Crawl a URL by tabbing through all focusable elements.
 * Records the complete focus sequence and discovers all interactive elements.
 */
export async function crawlPage(
  url: string,
  config: KeylensConfig,
): Promise<CrawlResult> {
  const startTime = Date.now();
  logger.info(`Launching ${config.browser} browser...`);

  const launcher = BROWSER_LAUNCHERS[config.browser];
  let browser: Browser;

  try {
    browser = await launcher.launch({
      headless: !config.headed,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (
      message.includes("Executable doesn't exist") ||
      message.includes("browserType.launch")
    ) {
      throw new CrawlError(
        `Playwright ${config.browser} browser is not installed. Run: npx playwright install ${config.browser}`,
        url,
      );
    }
    throw new CrawlError(`Failed to launch browser: ${message}`, url);
  }

  // Ensure browser cleanup on process termination
  const cleanup = async () => {
    try {
      await browser.close();
    } catch {
      // Ignore close errors during forced shutdown
    }
  };
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);

  try {
    const context = await browser.newContext({
      viewport: config.viewport,
    });
    const page = await context.newPage();

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

    // Take full-page screenshot
    logger.info("Capturing page screenshot...");
    const pageScreenshot = (await page.screenshot({ fullPage: true })).toString(
      "base64",
    );

    // Capture page dimensions
    const pageDimensions = (await page.evaluate(`(() => {
      return {
        width: Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth),
        height: Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight),
      };
    })()`)) as { width: number; height: number };

    // Test skip link functionality (before main tab crawl)
    logger.info("Testing skip link...");
    const skipLinkResult = await testSkipLink(page, config.tabDelay);
    if (skipLinkResult.found) {
      logger.debug(
        `Skip link ${skipLinkResult.functionWorks ? "works" : "found but does not function correctly"}`,
      );
    }

    // Discover all interactive elements
    logger.info("Discovering interactive elements...");
    const interactiveElements = await discoverInteractiveElements(page);
    logger.debug(`Found ${interactiveElements.length} interactive elements`);

    // Crawl the tab order
    logger.info("Crawling tab order...");
    const { focusSequence, cycleCompleted } = await crawlTabOrder(page, config);
    logger.debug(
      `Recorded ${focusSequence.length} focused elements, cycle completed: ${cycleCompleted}`,
    );

    // Mark interactive elements that were reached
    markReachedElements(interactiveElements, focusSequence);

    // Post-click interaction testing (if enabled)
    let interactionResults: InteractionResult[] | undefined;
    if (config.interactions) {
      logger.info("Testing post-click interactions...");
      interactionResults = await crawlInteractions(page, focusSequence, config.tabDelay);
      logger.debug(
        `Tested ${interactionResults!.length} interactions, ${interactionResults!.filter((r) => !r.focusReasonable).length} issue(s)`,
      );
    }

    const duration = Date.now() - startTime;
    logger.success(`Crawl completed in ${duration}ms`);

    return {
      url,
      focusSequence,
      interactiveElements,
      cycleCompleted,
      pageScreenshot,
      crawlDuration: duration,
      pageDimensions,
      skipLinkResult,
      interactionResults,
    };
  } finally {
    process.off("SIGINT", cleanup);
    process.off("SIGTERM", cleanup);
    await browser.close();
  }
}

/**
 * Test skip link functionality by tabbing through the first few elements,
 * finding a skip link, pressing Enter, and verifying focus moves to main content.
 */
async function testSkipLink(page: Page, tabDelay: number): Promise<SkipLinkResult> {
  // Click body to reset sequential focus navigation starting point
  await page.mouse.click(0, 0);
  await page.waitForTimeout(tabDelay);

  // Tab through first 5 elements looking for a skip link
  for (let i = 0; i < 5; i++) {
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

    // Click body to reset sequential focus navigation starting point
    await page.mouse.click(0, 0);
    await page.waitForTimeout(tabDelay);

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

  // No skip link found — click body to reset for main crawl
  await page.mouse.click(0, 0);
  await page.waitForTimeout(tabDelay);

  return { found: false, functionWorks: false };
}

/**
 * Tab through the page and record each focused element.
 */
async function crawlTabOrder(
  page: Page,
  config: KeylensConfig,
): Promise<{
  focusSequence: FocusedElement[];
  cycleCompleted: boolean;
}> {
  const focusSequence: FocusedElement[] = [];
  let cycleCompleted = false;
  let firstSelector: string | null = null;
  const captureScreenshots = config.captureElementScreenshots;
  const tabDelay = config.tabDelay;

  // Click the body to reset sequential focus navigation starting point
  await page.mouse.click(0, 0);
  await page.waitForTimeout(tabDelay);

  for (let i = 0; i < config.maxTabs; i++) {
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
      logger.warn(`Tab press ${i + 1} timed out, skipping`);
      continue;
    }

    // Get info about the currently focused element
    const elementInfo = (await page.evaluate(
      `(${GET_FOCUSED_ELEMENT_INFO_SCRIPT})()`,
    )) as FocusedElementInfo | null;

    if (!elementInfo) {
      // Focus is on body or document — may indicate end of cycle
      continue;
    }

    // Check if we've cycled back to the first element
    if (firstSelector === null) {
      firstSelector = elementInfo.selector;
    } else if (elementInfo.selector === firstSelector) {
      cycleCompleted = true;
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
      // If the check fails, assume not obscured
    }

    // Capture focused screenshot and computed focus styles if enabled
    let focusedScreenshot: string | undefined;
    let computedFocusStyles:
      | { outline: string; boxShadow: string; border: string }
      | undefined;
    if (captureScreenshots) {
      focusedScreenshot = await captureElementScreenshot(
        page,
        elementInfo.pageRect,
      );

      // Capture computed focus-related CSS styles while element is focused
      try {
        computedFocusStyles = await page.evaluate(`(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const s = window.getComputedStyle(el);
          return {
            outline: s.outline || '',
            boxShadow: s.boxShadow || '',
            border: s.border || '',
          };
        })()`);
      } catch {
        // Ignore style capture failures
      }
    }

    // Capture unfocused screenshot of the *previous* element (if screenshots enabled)
    // The previous element just lost focus, so it's now in unfocused state
    if (captureScreenshots && lastElement && !lastElement.unfocusedScreenshot) {
      lastElement.unfocusedScreenshot = await captureElementScreenshot(
        page,
        lastElement.pageRect ?? lastElement.boundingRect,
      );
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
      focusedScreenshot,
      computedFocusStyles: computedFocusStyles ?? undefined,
      outerHTML: elementInfo.outerHTML,
      ariaAttributes: Object.keys(elementInfo.ariaAttributes).length > 0 ? elementInfo.ariaAttributes : undefined,
      parentContext: elementInfo.parentContext ?? undefined,
    };

    focusSequence.push(focusedElement);
  }

  // Capture unfocused screenshot of the last element (it just lost focus when cycle ends)
  if (captureScreenshots && focusSequence.length > 0) {
    const lastEl = focusSequence[focusSequence.length - 1];
    if (!lastEl.unfocusedScreenshot) {
      // Tab once more so the last element loses focus
      await page.keyboard.press("Tab");
      await page.waitForTimeout(tabDelay);
      lastEl.unfocusedScreenshot = await captureElementScreenshot(
        page,
        lastEl.pageRect ?? lastEl.boundingRect,
      );
    }
  }

  return { focusSequence, cycleCompleted };
}

/**
 * Capture a screenshot of a specific element region on the page.
 * Returns base64-encoded PNG or undefined if capture fails.
 */
async function captureElementScreenshot(
  page: Page,
  rect: BoundingRect,
): Promise<string | undefined> {
  try {
    // Add padding around the element for context
    const padding = 10;
    const clip = {
      x: Math.max(0, rect.x - padding),
      y: Math.max(0, rect.y - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };

    const buffer = await page.screenshot({
      clip,
      type: "png",
    });
    return buffer.toString("base64");
  } catch {
    logger.debug(
      `Failed to capture element screenshot at (${rect.x}, ${rect.y})`,
    );
    return undefined;
  }
}

/**
 * Discover all interactive elements on the page.
 */
async function discoverInteractiveElements(
  page: Page,
): Promise<InteractiveElement[]> {
  const result = await page.evaluate(`(${GET_INTERACTIVE_ELEMENTS_SCRIPT})()`);
  return (result ?? []) as InteractiveElement[];
}

/**
 * Click buttons found during tab crawl and verify focus isn't lost.
 * Only clicks `<button>` and `role="button"` elements — skips links to avoid navigation.
 */
async function crawlInteractions(
  page: Page,
  focusSequence: FocusedElement[],
  tabDelay: number,
): Promise<InteractionResult[]> {
  const results: InteractionResult[] = [];

  // Filter to clickable non-link elements
  const clickable = focusSequence.filter(
    (el) =>
      el.tagName === "button" || el.role === "button" || el.tagName === "input",
  );

  for (const el of clickable) {
    // Skip submit inputs — they can trigger form submission/navigation
    if (el.tagName === "input" && el.outerHTML.includes('type="submit"')) {
      continue;
    }

    try {
      // Focus the element first, then click it
      const locator = page.locator(el.selector).first();
      await locator.focus();
      await page.waitForTimeout(tabDelay);
      await locator.click();
      await page.waitForTimeout(tabDelay * 2);

      // Check where focus ended up
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

      // Focus is "reasonable" if it's on:
      // - the clicked element itself
      // - a child of the clicked element
      // - or anywhere that isn't body/null (e.g. a dialog that opened)
      const focusReasonable = focusAfter !== null;

      const issue = !focusReasonable
        ? `Focus lost after clicking ${el.selector} — activeElement reverted to body`
        : undefined;

      results.push({
        element: {
          selector: el.selector,
          tagName: el.tagName,
          role: el.role,
          accessibleName: el.accessibleName,
        },
        action: "click",
        focusAfter,
        focusReasonable,
        issue,
      });
    } catch {
      logger.debug(
        `Interaction test skipped for ${el.selector} (click failed)`,
      );
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
