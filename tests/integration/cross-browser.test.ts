import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { audit } from "@/index.js";
import type { KeylensConfig } from "@/types/index.js";

describe("Cross-browser audit contract", () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    const fixture = readFileSync(
      resolve(__dirname, "../fixtures/cross-browser-page.html"),
      "utf8",
    );
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fixture);
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, "127.0.0.1", resolvePromise),
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Cross-browser fixture server did not expose an address");
    }
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(
    () =>
      new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      }),
  );

  it("crawls, captures, evaluates, and safely activates controls", async () => {
    const browser =
      (process.env.KEYLENS_TEST_BROWSER as
        KeylensConfig["browser"] | undefined) ?? "chromium";
    const report = await audit(url, {
      browser,
      reporters: [],
      maxTabs: 12,
      tabDelay: 10,
      waitAfterLoad: 10,
      capture: {
        page: "viewport",
        elements: true,
        limits: {
          maxElements: 3,
          maxDimension: 4096,
          maxPixels: 10_000_000,
          maxBytes: 10 * 1024 * 1024,
        },
      },
      interactions: {
        enabled: true,
        maxCases: 1,
        timeout: 2_000,
        include: ["#preserve"],
        exclude: [],
        actions: ["click"],
        isolation: "reload",
        navigation: "block",
        excludeDestructive: true,
      },
      timeouts: {
        total: 30_000,
        crawl: 25_000,
        interactions: 10_000,
        rules: 5_000,
      },
    });

    expect(report.config.browser).toBe(browser);
    expect(report.focusSequence?.length).toBeGreaterThan(0);
    const selectors =
      report.focusSequence?.map((element) => element.selector) ?? [];
    const preserveIndex = selectors.indexOf("#preserve");
    const positiveTabindexIndex = selectors.indexOf("#main > a");
    expect(preserveIndex).toBeGreaterThanOrEqual(0);
    expect(positiveTabindexIndex).toBeGreaterThanOrEqual(0);
    expect(positiveTabindexIndex).toBeLessThan(preserveIndex);
    expect(selectors[preserveIndex + 1]).toBe("#main > input:nth-of-type(2)");
    expect(report.rules).toHaveLength(8);
    expect(report.summary.errors).toBe(0);
    expect(
      report.rules.find((rule) => rule.ruleId === "skip-link")?.passed,
    ).toBe(true);
    expect(
      report.assets.some((asset) => asset.type === "page-screenshot"),
    ).toBe(true);
    expect(
      report.focusSequence?.some(
        (element) =>
          element.focusedScreenshotAssetId &&
          element.unfocusedScreenshotAssetId,
      ),
    ).toBe(true);
    if (report.interactionResults?.length === 0) {
      throw new Error(
        `No interaction candidates were tested: ${JSON.stringify(
          report.focusSequence?.map((element) => ({
            selector: element.selector,
            tagName: element.tagName,
            role: element.role,
          })),
        )}`,
      );
    }
    expect(report.interactionResults).toContainEqual(
      expect.objectContaining({
        element: expect.objectContaining({ selector: "#preserve" }),
        status: "passed",
        reason: "focus-preserved",
      }),
    );
    expect(
      report.rules.find((rule) => rule.ruleId === "tabindex-abuse")?.passed,
    ).toBe(false);
  }, 45_000);
});
