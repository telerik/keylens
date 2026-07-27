import { describe, it, expect } from "vitest";
import { FocusAfterInteractionRule } from "@/rules/focus-after-interaction.js";
import { makeCrawlResult } from "@tests/helpers/factories.js";
import type { InteractionResult } from "@/types/index.js";

function makeInteractionResult(
  overrides: Partial<InteractionResult> = {},
): InteractionResult {
  return {
    element: {
      selector: "button.test",
      tagName: "button",
      role: "button",
      accessibleName: "Test Button",
    },
    action: "click",
    focusAfter: {
      selector: "button.test",
      tagName: "button",
      role: "button",
    },
    status: "passed",
    reason: "focus-preserved",
    duration: 10,
    ...overrides,
  };
}

describe("FocusAfterInteractionRule", () => {
  const rule = new FocusAfterInteractionRule();

  it("should pass when no interaction results are present", async () => {
    const result = await rule.evaluate(makeCrawlResult({}));

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should pass when all interactions maintain focus", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactionResults: [
          makeInteractionResult({ status: "passed" }),
          makeInteractionResult({
            element: {
              selector: "button.other",
              tagName: "button",
              role: "button",
              accessibleName: "Other",
            },
            status: "passed",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when focus is lost after clicking", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactionResults: [
          makeInteractionResult({
            element: {
              selector: "button.bad",
              tagName: "button",
              role: "button",
              accessibleName: "Bad Button",
            },
            focusAfter: null,
            status: "failed",
            reason: "focus-lost",
            message:
              "Focus lost after clicking button.bad — activeElement reverted to body",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.severity).toBe("error");
    expect(result.violations[0]!.wcag).toContain("2.4.3");
    expect(result.violations[0]!.wcag).toContain("2.4.7");
    expect(result.violations[0]!.elements[0]!.selector).toBe("button.bad");
    expect(result.violations[0]!.message).toContain("button.bad");
  });

  it("should report each failed interaction as a separate violation", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactionResults: [
          makeInteractionResult({ status: "passed" }),
          makeInteractionResult({
            element: {
              selector: "button.bad-1",
              tagName: "button",
              role: "button",
              accessibleName: "Bad 1",
            },
            focusAfter: null,
            status: "failed",
            reason: "focus-lost",
            message: "Focus lost after clicking button.bad-1",
          }),
          makeInteractionResult({
            element: {
              selector: "button.bad-2",
              tagName: "button",
              role: "button",
              accessibleName: "Bad 2",
            },
            focusAfter: null,
            status: "failed",
            reason: "focus-lost",
            message: "Focus lost after clicking button.bad-2",
          }),
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0]!.elements[0]!.selector).toBe("button.bad-1");
    expect(result.violations[1]!.elements[0]!.selector).toBe("button.bad-2");
  });

  it("should pass with empty interaction results array", async () => {
    const result = await rule.evaluate(
      makeCrawlResult({
        interactionResults: [],
      }),
    );

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("should error when interaction cases could not be evaluated", async () => {
    await expect(
      rule.evaluate(
        makeCrawlResult({
          interactionResults: [
            makeInteractionResult({
              status: "error",
              reason: "action-failed",
            }),
          ],
        }),
      ),
    ).rejects.toThrow("1 interaction case(s) could not be evaluated");
  });
});
