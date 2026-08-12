import { describe, expect, it, vi } from "vitest";
import type { BrowserContext, Page } from "playwright";
import { applyPrepareCookies, preparePage } from "@/crawler/prepare.js";
import { normalizeConfig } from "@/utils/config.js";
import type { AuditEvent, KeylensConfig } from "@/types/index.js";

interface FakeLocator {
  first: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  isVisible: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
  waitFor: ReturnType<typeof vi.fn>;
}

function createLocator(
  overrides: {
    count?: number;
    visible?: boolean;
    clickError?: Error;
    waitForHidden?: boolean;
  } = {},
): FakeLocator {
  const { count = 1, visible = true, clickError, waitForHidden = true } =
    overrides;
  const locator: FakeLocator = {
    first: vi.fn(() => locator),
    count: vi.fn().mockResolvedValue(count),
    isVisible: vi.fn().mockResolvedValue(visible),
    click: vi.fn().mockImplementation(() =>
      clickError ? Promise.reject(clickError) : Promise.resolve(undefined),
    ),
    waitFor: vi.fn().mockImplementation(() =>
      waitForHidden
        ? Promise.resolve(undefined)
        : Promise.reject(new Error("timeout waiting for hidden state")),
    ),
  };
  return locator;
}

function createFrame(selectorMap: Record<string, FakeLocator> = {}) {
  return {
    locator: vi.fn((selector: string) => selectorMap[selector] ?? createLocator({ count: 0 })),
  };
}

function createPage(
  options: {
    frames?: ReturnType<typeof createFrame>[];
    evaluateImpl?: (script: string) => unknown;
    locatorMap?: Record<string, FakeLocator>;
  } = {},
): Page {
  const { frames = [createFrame()], evaluateImpl, locatorMap = {} } = options;
  return {
    frames: vi.fn(() => frames),
    locator: vi.fn((selector: string) => locatorMap[selector] ?? createLocator({ count: 0 })),
    evaluate: vi.fn(evaluateImpl ?? (() => Promise.resolve(undefined))),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

function withPrepare(overrides: Partial<KeylensConfig["prepare"]>): KeylensConfig {
  return normalizeConfig({ prepare: overrides });
}

describe("preparePage", () => {
  describe("no configured work", () => {
    it("returns attempted:false and never touches the page", async () => {
      const page = createPage();
      const config = withPrepare({
        dismissOverlays: false,
        expandScrollContainers: false,
      });

      const result = await preparePage(page, config);

      expect(result).toEqual({
        attempted: false,
        dismissals: [],
        warnings: [],
        duration: 0,
      });
      expect(page.frames).not.toHaveBeenCalled();
    });
  });

  describe("known overlay presets", () => {
    it("dismisses a known preset overlay via the preferred reject action", async () => {
      const frame = createFrame({
        "#onetrust-banner-sdk": createLocator(),
        "#onetrust-reject-all-handler": createLocator(),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({});

      const result = await preparePage(page, config, undefined, "https://example.com");

      expect(result.attempted).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.dismissals).toEqual([
        {
          provider: "OneTrust",
          action: "reject",
          selector: "#onetrust-reject-all-handler",
          verified: true,
        },
      ]);
    });

    it("falls back to accept when the reject button isn't present but the container is", async () => {
      const frame = createFrame({
        "#onetrust-banner-sdk": createLocator(),
        "#onetrust-accept-btn-handler": createLocator(),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({});

      const result = await preparePage(page, config);

      expect(result.dismissals[0]).toMatchObject({
        provider: "OneTrust",
        action: "accept",
      });
    });

    it("records a warning when the container is found but no action button matches", async () => {
      const frame = createFrame({
        "#onetrust-banner-sdk": createLocator(),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({});

      const result = await preparePage(page, config);

      expect(result.dismissals).toHaveLength(0);
      expect(result.warnings).toEqual([
        expect.stringContaining(
          "OneTrust: banner detected but no dismiss action succeeded",
        ),
      ]);
    });

    it("records a warning and tries the next action when a click throws", async () => {
      const frame = createFrame({
        "#onetrust-banner-sdk": createLocator(),
        "#onetrust-reject-all-handler": createLocator({
          clickError: new Error("detached from DOM"),
        }),
        "#onetrust-accept-btn-handler": createLocator(),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({});

      const result = await preparePage(page, config);

      expect(result.warnings).toEqual([
        expect.stringContaining(
          "OneTrust: failed to click reject button (detached from DOM)",
        ),
      ]);
      expect(result.dismissals[0]).toMatchObject({ action: "accept" });
    });

    it("reports verified:false when the container never disappears after clicking", async () => {
      const frame = createFrame({
        "#onetrust-banner-sdk": createLocator({ waitForHidden: false }),
        "#onetrust-reject-all-handler": createLocator(),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({});

      const result = await preparePage(page, config);

      expect(result.dismissals[0]).toMatchObject({ verified: false });
    });
  });

  describe("generic heuristic fallback", () => {
    it("falls back to the generic heuristic when no known preset matches", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () =>
          Promise.resolve({
            containerSelector: "#generic-banner",
            buttonSelector: "#generic-reject",
          }),
        locatorMap: {
          "#generic-banner": createLocator(),
          "#generic-reject": createLocator(),
        },
      });
      const config = withPrepare({});

      const result = await preparePage(page, config);

      expect(result.dismissals).toEqual([
        {
          provider: "heuristic",
          action: "reject",
          selector: "#generic-reject",
          verified: true,
        },
      ]);
    });

    it("records a warning when the heuristic scan itself throws", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () => Promise.reject(new Error("evaluate boom")),
      });
      const config = withPrepare({ expandScrollContainers: false });

      const result = await preparePage(page, config);

      expect(result.dismissals).toHaveLength(0);
      expect(result.warnings).toEqual([
        expect.stringContaining("Heuristic overlay scan failed: evaluate boom"),
      ]);
    });

    it("records a warning per action and gives up when every heuristic click fails", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () =>
          Promise.resolve({
            containerSelector: "#generic-banner",
            buttonSelector: "#generic-reject",
          }),
        locatorMap: {
          "#generic-banner": createLocator(),
          "#generic-reject": createLocator({
            clickError: new Error("not clickable"),
          }),
        },
      });
      const config = withPrepare({});

      const result = await preparePage(page, config);

      expect(result.dismissals).toHaveLength(0);
      // One attempt per action in actionOrder (reject, accept, close).
      expect(result.warnings).toHaveLength(3);
      for (const warning of result.warnings) {
        expect(warning).toContain("Heuristic overlay: failed to click");
      }
    });
  });

  describe("faux-scroll container expansion", () => {
    it("reports the expanded container when the browser script detects one", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () =>
          Promise.resolve({
            selector: "div.parallax",
            originalHeight: 5198,
            expandedHeight: 5198,
            reverted: false,
          }),
      });
      const config = withPrepare({
        dismissOverlays: false,
        expandScrollContainers: true,
      });

      const result = await preparePage(page, config);

      expect(result.scrollContainerExpanded).toEqual({
        selector: "div.parallax",
        originalHeight: 5198,
        expandedHeight: 5198,
      });
      expect(result.warnings).toHaveLength(0);
    });

    it("reverts and warns when the container is found but expanding it had no effect (e.g. transform-driven content)", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () =>
          Promise.resolve({
            selector: "div.parallax",
            originalHeight: 5198,
            expandedHeight: 720,
            reverted: true,
          }),
      });
      const config = withPrepare({
        dismissOverlays: false,
        expandScrollContainers: true,
      });

      const result = await preparePage(page, config);

      expect(result.scrollContainerExpanded).toBeUndefined();
      expect(result.warnings).toEqual([
        expect.stringContaining(
          "Detected a full-page scroll container (div.parallax) but could not expand it",
        ),
      ]);
    });

    it("does nothing when the browser script finds no faux-scroll container", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () => Promise.resolve(null),
      });
      const config = withPrepare({
        dismissOverlays: false,
        expandScrollContainers: true,
      });

      const result = await preparePage(page, config);

      expect(result.scrollContainerExpanded).toBeUndefined();
      expect(result.warnings).toHaveLength(0);
    });

    it("ignores a malformed result shape from the browser script", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () => Promise.resolve({ unrelated: true }),
      });
      const config = withPrepare({
        dismissOverlays: false,
        expandScrollContainers: true,
      });

      const result = await preparePage(page, config);

      expect(result.scrollContainerExpanded).toBeUndefined();
      expect(result.warnings).toHaveLength(0);
    });

    it("records a warning when the expansion script throws", async () => {
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: () => Promise.reject(new Error("evaluate boom")),
      });
      const config = withPrepare({
        dismissOverlays: false,
        expandScrollContainers: true,
      });

      const result = await preparePage(page, config);

      expect(result.scrollContainerExpanded).toBeUndefined();
      expect(result.warnings).toEqual([
        expect.stringContaining(
          "Scroll container expansion failed: evaluate boom",
        ),
      ]);
    });

    it("is skipped entirely when expandScrollContainers is false", async () => {
      const evaluate = vi.fn().mockResolvedValue({
        selector: "div.parallax",
        originalHeight: 5198,
        expandedHeight: 5198,
        reverted: false,
      });
      const page = createPage({
        frames: [createFrame()],
        evaluateImpl: evaluate,
      });
      const config = withPrepare({
        dismissOverlays: false,
        expandScrollContainers: false,
        dismissSelectors: ["#x"],
      });

      const result = await preparePage(page, config);

      expect(result.scrollContainerExpanded).toBeUndefined();
      expect(evaluate).not.toHaveBeenCalled();
    });
  });

  describe("custom dismiss selectors", () => {
    it("clicks custom selectors that are present and skips missing ones", async () => {
      const frame = createFrame({
        "#a": createLocator(),
        "#b": createLocator(),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({
        dismissOverlays: false,
        dismissSelectors: ["#a", "#missing", "#b"],
      });

      const result = await preparePage(page, config);

      expect(result.dismissals).toEqual([
        { provider: "custom", action: "custom", selector: "#a", verified: true },
        { provider: "custom", action: "custom", selector: "#b", verified: true },
      ]);
    });

    it("records a warning when a custom selector click fails", async () => {
      const frame = createFrame({
        "#a": createLocator({ clickError: new Error("boom") }),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({
        dismissOverlays: false,
        dismissSelectors: ["#a"],
      });

      const result = await preparePage(page, config);

      expect(result.dismissals).toHaveLength(0);
      expect(result.warnings).toEqual([
        expect.stringContaining("Custom dismiss selector failed: #a (boom)"),
      ]);
    });
  });

  describe("generic prepare steps", () => {
    it("runs click/press/wait/waitFor steps in order and calls the underlying page APIs", async () => {
      const frame = createFrame({ "#btn": createLocator() });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({
        dismissOverlays: false,
        steps: [
          { type: "click", selector: "#btn" },
          { type: "press", key: "Escape" },
          { type: "wait", ms: 50 },
          { type: "waitFor", selector: "#done" },
        ],
      });

      const result = await preparePage(page, config);

      expect(result.warnings).toHaveLength(0);
      expect(page.keyboard.press).toHaveBeenCalledWith("Escape");
      expect(page.waitForTimeout).toHaveBeenCalledWith(50);
      expect(page.waitForSelector).toHaveBeenCalledWith("#done", {
        timeout: 5000,
      });
    });

    it("warns when a required click selector is missing", async () => {
      const page = createPage();
      const config = withPrepare({
        dismissOverlays: false,
        steps: [{ type: "click", selector: "#missing" }],
      });

      const result = await preparePage(page, config);

      expect(result.warnings).toEqual([
        expect.stringContaining(
          "Prepare step: click selector not found: #missing",
        ),
      ]);
    });

    it("does not warn when an optional click selector is missing", async () => {
      const page = createPage();
      const config = withPrepare({
        dismissOverlays: false,
        steps: [{ type: "click", selector: "#missing", optional: true }],
      });

      const result = await preparePage(page, config);

      expect(result.warnings).toHaveLength(0);
    });

    it("warns when a required click throws", async () => {
      const frame = createFrame({
        "#btn": createLocator({ clickError: new Error("nope") }),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({
        dismissOverlays: false,
        steps: [{ type: "click", selector: "#btn" }],
      });

      const result = await preparePage(page, config);

      expect(result.warnings).toEqual([
        expect.stringContaining("Prepare step: click failed for #btn (nope)"),
      ]);
    });

    it("warns when waitFor times out", async () => {
      const page = createPage();
      (page.waitForSelector as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("timeout exceeded"),
      );
      const config = withPrepare({
        dismissOverlays: false,
        steps: [{ type: "waitFor", selector: "#never", timeout: 100 }],
      });

      const result = await preparePage(page, config);

      expect(result.warnings).toEqual([
        expect.stringContaining(
          "Prepare step: waitFor timed out for #never (timeout exceeded)",
        ),
      ]);
    });
  });

  describe("events", () => {
    it("emits phase-started and phase-completed events around the prepare phase", async () => {
      const events: AuditEvent[] = [];
      const page = createPage();
      const config = withPrepare({
        dismissOverlays: false,
        dismissSelectors: ["#x"],
      });

      await preparePage(
        page,
        config,
        undefined,
        "https://example.com",
        (event) => events.push(event),
      );

      expect(events).toContainEqual(
        expect.objectContaining({
          type: "phase-started",
          phase: "prepare",
          url: "https://example.com",
        }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "phase-completed",
          phase: "prepare",
          url: "https://example.com",
        }),
      );
    });

    it("emits an overlay-dismissed event with dismissal details", async () => {
      const events: AuditEvent[] = [];
      const frame = createFrame({
        "#onetrust-banner-sdk": createLocator(),
        "#onetrust-reject-all-handler": createLocator(),
      });
      const page = createPage({ frames: [frame] });
      const config = withPrepare({});

      await preparePage(
        page,
        config,
        undefined,
        "https://example.com",
        (event) => events.push(event),
      );

      expect(events).toContainEqual(
        expect.objectContaining({
          type: "overlay-dismissed",
          provider: "OneTrust",
          action: "reject",
          selector: "#onetrust-reject-all-handler",
          verified: true,
        }),
      );
    });
  });

  describe("cancellation and error handling", () => {
    it("propagates real cancellation instead of degrading to a warning", async () => {
      const controller = new AbortController();
      controller.abort();
      const page = createPage();
      const config = withPrepare({
        dismissOverlays: false,
        dismissSelectors: ["#x"],
      });

      await expect(
        preparePage(page, config, controller.signal, "https://example.com"),
      ).rejects.toMatchObject({ code: "ABORTED", phase: "prepare" });
    });

    it("degrades an unexpected internal error to a warning instead of throwing", async () => {
      const page = createPage();
      (page.frames as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("frames boom");
      });
      const config = withPrepare({});

      const result = await preparePage(page, config, undefined, "https://example.com");

      expect(result.attempted).toBe(true);
      expect(result.warnings).toEqual([
        expect.stringContaining("Prepare phase error: frames boom"),
      ]);
    });
  });
});

describe("applyPrepareCookies", () => {
  it("does nothing when no cookies are configured", async () => {
    const context = { addCookies: vi.fn() } as unknown as BrowserContext;
    const config = withPrepare({});

    await applyPrepareCookies(context, config, "https://example.com");

    expect(context.addCookies).not.toHaveBeenCalled();
  });

  it("applies cookies with default domain/path derived from the URL", async () => {
    const context = {
      addCookies: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext;
    const config = withPrepare({
      cookies: [{ name: "consent", value: "true" }],
    });

    await applyPrepareCookies(context, config, "https://example.com/page");

    expect(context.addCookies).toHaveBeenCalledWith([
      { name: "consent", value: "true", domain: "example.com", path: "/" },
    ]);
  });

  it("applies explicit domain/path overrides when provided", async () => {
    const context = {
      addCookies: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext;
    const config = withPrepare({
      cookies: [
        { name: "c", value: "v", domain: ".example.com", path: "/app" },
      ],
    });

    await applyPrepareCookies(context, config, "https://example.com");

    expect(context.addCookies).toHaveBeenCalledWith([
      { name: "c", value: "v", domain: ".example.com", path: "/app" },
    ]);
  });
});
