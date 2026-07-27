import type {
  Rule,
  CrawlResult,
  RuleResult,
  FocusedElement,
} from "../types/index.js";

/** Minimum pixel difference ratio to consider a focus indicator present. */
const DIFF_THRESHOLD = 0.01;

/**
 * Compare two base64 PNG screenshots using pixelmatch.
 * Returns the ratio of different pixels, or null if comparison fails.
 */
export async function compareScreenshots(
  focusedBase64: string,
  unfocusedBase64: string,
  threshold: number = DIFF_THRESHOLD,
): Promise<number | null> {
  try {
    const { PNG } = await import("pngjs");
    const pixelmatch = (await import("pixelmatch")).default;

    const focusedImg = PNG.sync.read(Buffer.from(focusedBase64, "base64"));
    const unfocusedImg = PNG.sync.read(Buffer.from(unfocusedBase64, "base64"));

    // Images must be the same size
    if (
      focusedImg.width !== unfocusedImg.width ||
      focusedImg.height !== unfocusedImg.height
    ) {
      return null;
    }

    const { width, height } = focusedImg;
    const totalPixels = width * height;
    if (totalPixels === 0) return null;

    const diffPixels = pixelmatch(
      focusedImg.data,
      unfocusedImg.data,
      undefined,
      width,
      height,
      { threshold },
    );

    return diffPixels / totalPixels;
  } catch {
    return null;
  }
}

/**
 * Detects elements that lack a visible focus indicator.
 *
 * Phase 1: Heuristic — checks for outline: none / outline: 0 patterns in HTML.
 * Phase 2: Screenshot diffing — compares focused vs unfocused screenshots
 *          using pixelmatch to detect visible focus style changes.
 */
export class MissingFocusIndicatorRule implements Rule {
  id = "missing-focus-indicator";
  name = "Missing Focus Indicator";
  description =
    "Detects interactive elements that lack a visible focus indicator.";
  severity = "warning" as const;
  wcag = ["2.4.7"];

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];
    const { focusSequence } = crawlResult;

    // Phase 1: Check for elements with suppressed outlines via CSS patterns
    const suspiciousElements = focusSequence.filter((el) => {
      const html = el.outerHTML.toLowerCase();
      return (
        html.includes("outline: none") ||
        html.includes("outline: 0") ||
        html.includes("outline:none") ||
        html.includes("outline:0")
      );
    });

    if (suspiciousElements.length > 0) {
      violations.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: this.severity,
        message: `${suspiciousElements.length} element(s) may have their focus indicator suppressed via CSS (outline: none).`,
        elements: suspiciousElements.map((el) => ({
          selector: el.selector,
          outerHTML: el.outerHTML,
          tabPosition: el.tabIndex,
          accessibleName: el.accessibleName || undefined,
        })),
        wcag: this.wcag,
        impact:
          "Keyboard users cannot see which element currently has focus, making navigation extremely difficult.",
      });
    }

    // Phase 2: Screenshot-based focus indicator detection
    const screenshotElements = focusSequence.filter(
      (el) => el.focusedScreenshot && el.unfocusedScreenshot,
    );

    if (screenshotElements.length > 0) {
      const noIndicatorElements: FocusedElement[] = [];

      for (const el of screenshotElements) {
        const diffRatio = await compareScreenshots(
          el.focusedScreenshot!,
          el.unfocusedScreenshot!,
        );

        if (diffRatio !== null) {
          if (diffRatio < DIFF_THRESHOLD) {
            el.hasFocusIndicator = false;
            noIndicatorElements.push(el);
          } else {
            el.hasFocusIndicator = true;
          }
        }
      }

      if (noIndicatorElements.length > 0) {
        violations.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: "error",
          message: `${noIndicatorElements.length} element(s) show no visible change between focused and unfocused states (screenshot comparison).`,
          elements: noIndicatorElements.map((el) => ({
            selector: el.selector,
            outerHTML: el.outerHTML,
            tabPosition: el.tabIndex,
            accessibleName: el.accessibleName || undefined,
          })),
          wcag: this.wcag,
          impact:
            "Screenshot comparison confirms no visible focus indicator. Keyboard users cannot see which element has focus.",
        });
      }
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      status: violations.length === 0 ? "passed" : "failed",
      violations,
      duration: 0,
    };
  }
}
