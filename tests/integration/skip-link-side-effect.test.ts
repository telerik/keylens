import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { audit } from "@/index.js";
import { DEFAULT_CONFIG } from "@/utils/config.js";

describe("Integration: skip link activation does not corrupt the full crawl", () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    const fixture = readFileSync(
      resolve(__dirname, "../fixtures/skip-link-side-effect-page.html"),
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
      throw new Error("Skip link fixture server did not expose an address");
    }
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(
    () =>
      new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      }),
  );

  it("still reaches every interactive element after the skip link functional test activates a stateful widget", async () => {
    const report = await audit(url, {
      ...DEFAULT_CONFIG,
      reporters: [],
      maxTabs: 20,
      tabDelay: 20,
      waitAfterLoad: 50,
    });

    // The fixture's skip link mutates page state on activation so that (without
    // a reload) every subsequent Tab press re-focuses the skip link itself,
    // masquerading as a completed cycle after a single element.
    expect(report.focusSequence!.length).toBeGreaterThan(1);

    const unreachableRule = report.rules.find(
      (r) => r.ruleId === "unreachable-elements",
    );
    expect(unreachableRule).toBeDefined();
    expect(unreachableRule!.passed).toBe(true);

    const skipLinkRule = report.rules.find((r) => r.ruleId === "skip-link");
    expect(skipLinkRule).toBeDefined();
    expect(skipLinkRule!.passed).toBe(true);
  });
});
