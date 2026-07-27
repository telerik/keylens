import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/utils/config.js";

const mocks = vi.hoisted(() => {
  const launch = vi.fn();
  return { launch };
});

vi.mock("playwright", () => ({
  chromium: { launch: mocks.launch },
  firefox: { launch: mocks.launch },
  webkit: { launch: mocks.launch },
}));

describe("crawlPage lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("closes page, context, and browser before an aborted crawl rejects", async () => {
    let rejectWait: ((error: Error) => void) | undefined;
    let markWaitStarted: (() => void) | undefined;
    const waitStarted = new Promise<void>((resolve) => {
      markWaitStarted = resolve;
    });

    const page = {
      on: vi.fn(),
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectWait = reject;
            markWaitStarted?.();
          }),
      ),
      removeAllListeners: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
      close: vi.fn().mockImplementation(async () => {
        rejectWait?.(new Error("browser closed"));
      }),
    };
    mocks.launch.mockResolvedValue(browser);

    const { crawlPage } = await import("@/crawler/index.js");
    const controller = new AbortController();
    const pending = crawlPage(
      "https://example.com",
      { ...DEFAULT_CONFIG, waitAfterLoad: 10_000 },
      controller.signal,
    );

    await waitStarted;
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "ABORTED",
      phase: "crawl",
    });
    expect(page.removeAllListeners).toHaveBeenCalled();
    expect(page.close).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalled();
  });

  it("aborts a stalled launch and closes the browser if launch finishes later", async () => {
    let resolveLaunch:
      | ((browser: { close: () => Promise<void> }) => void)
      | undefined;
    const browser = {
      close: vi.fn().mockResolvedValue(undefined),
    };
    mocks.launch.mockReturnValue(
      new Promise((resolve) => {
        resolveLaunch = resolve;
      }),
    );

    const { crawlPage } = await import("@/crawler/index.js");
    const controller = new AbortController();
    const pending = crawlPage(
      "https://example.com",
      DEFAULT_CONFIG,
      controller.signal,
    );

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "ABORTED",
      phase: "crawl",
    });

    resolveLaunch?.(browser);
    await vi.waitFor(() => expect(browser.close).toHaveBeenCalledOnce());
  });
});
