import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";
import { audit } from "@/index.js";
import { DEFAULT_CONFIG } from "@/utils/config.js";
import type { KeylensConfig } from "@/types/index.js";

function serveFixture(fixtureName: string): Promise<{
  server: Server;
  url: string;
}> {
  const html = readFileSync(
    resolve(__dirname, `../fixtures/${fixtureName}`),
    "utf-8",
  );
  return new Promise((resolvePromise) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolvePromise({ server, url: `http://localhost:${port}` });
    });
  });
}

function makeConfig(overrides: Partial<KeylensConfig> = {}): KeylensConfig {
  return {
    ...DEFAULT_CONFIG,
    reporters: [],
    ai: { ...DEFAULT_CONFIG.ai, enabled: false },
    maxTabs: 20,
    waitAfterLoad: 100,
    tabDelay: 10,
    ...overrides,
  };
}

describe("Integration: roving-tabindex verification", () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    const fixture = await serveFixture("roving-tabindex-page.html");
    server = fixture.server;
    url = fixture.url;
  });

  afterAll(() => {
    server?.close();
  });

  it("reaches every member of a 2D grid via a single-key sweep, not a combined-key one", async () => {
    const report = await audit(url, makeConfig());

    const group = report.rovingTabindexGroups?.find(
      (g) => g.containerRole === "grid",
    );
    expect(group).toBeDefined();
    expect(group!.totalMembers).toBe(10);
    expect(group!.unreachedViaArrowKeys).toHaveLength(0);
    expect(group!.reachedViaArrowKeys).toHaveLength(10);
  });

  it("merges sibling tablists that share one flat keyboard domain", async () => {
    const report = await audit(url, makeConfig());

    const group = report.rovingTabindexGroups?.find(
      (g) => g.containerRole === "tablist",
    );
    expect(group).toBeDefined();
    // Merged: tablist-a's 2 tabs + tablist-b's 2 orphan tabs, verified together.
    expect(group!.totalMembers).toBe(4);
    expect(group!.unreachedViaArrowKeys).toHaveLength(0);
  });

  it("does not flag the orphan tablist's members as unreachable", async () => {
    const report = await audit(url, makeConfig());

    const rule = report.rules.find((r) => r.ruleId === "unreachable-elements");
    expect(rule?.passed).toBe(true);
    const flaggedSelectors = (rule?.violations[0]?.elements ?? []).map(
      (el) => el.selector,
    );
    expect(flaggedSelectors).not.toContain("#tab-b1");
    expect(flaggedSelectors).not.toContain("#tab-b2");
  });

  it("detects a native radiogroup via implicit role, verified by native browser arrow-key handling", async () => {
    const report = await audit(url, makeConfig());

    const group = report.rovingTabindexGroups?.find(
      (g) => g.containerRole === "radiogroup",
    );
    expect(group).toBeDefined();
    expect(group!.totalMembers).toBe(3);
    expect(group!.unreachedViaArrowKeys).toHaveLength(0);

    const radioElement = (report.interactiveElements ?? []).find(
      (el) => el.selector === "#radio-2",
    );
    expect(radioElement?.role).toBe("radio");
    expect(radioElement?.rovingContainerSelector).toBe("#native-radiogroup");
  });

  it("skips a container-retains-focus widget whose members carry no tabindex attribute at all", async () => {
    const report = await audit(url, makeConfig());

    // A null tabindexAttr must not be treated as a real tab stop - otherwise
    // verifyRovingTabindexGroups force-focuses a non-focusable <div> and
    // reports every member unreachable, even though the container itself
    // (the real Tab stop) is fully keyboard-operable.
    const group = report.rovingTabindexGroups?.find((g) =>
      g.reachedViaArrowKeys
        .concat(
          g.unreachedViaArrowKeys.map((selector) => ({
            selector,
            pageRect: { x: 0, y: 0, width: 0, height: 0 },
          })),
        )
        .some((m) => m.selector.startsWith("#cf-item")),
    );
    expect(group).toBeUndefined();
  });

  it("skips a group where every member already has tabindex=0 (no roving-tabindex pattern at all)", async () => {
    const report = await audit(url, makeConfig());

    const group = report.rovingTabindexGroups?.find((g) =>
      g.reachedViaArrowKeys
        .concat(
          g.unreachedViaArrowKeys.map((selector) => ({
            selector,
            pageRect: { x: 0, y: 0, width: 0, height: 0 },
          })),
        )
        .some((m) => m.selector.startsWith("#flat-item")),
    );
    expect(group).toBeUndefined();
  });

  it("passes the roving-tabindex-broken rule for all widgets", async () => {
    const report = await audit(url, makeConfig());

    const rule = report.rules.find(
      (r) => r.ruleId === "roving-tabindex-broken",
    );
    expect(rule?.passed).toBe(true);
    expect(rule?.violations).toHaveLength(0);
  });
});
