import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { audit } from "@/index.js";
import { DEFAULT_CONFIG } from "@/utils/config.js";
import type { AuditReport } from "@/types/index.js";

describe("Integration: rule behaviour on small HTML fixtures", () => {
  let server: Server;
  let url: string;
  let current = "";

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        readFileSync(
          resolve(__dirname, `../fixtures/rules/${current}.html`),
          "utf8",
        ),
      );
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Fixture server did not expose an address");
    }
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(
    () =>
      new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
      }),
  );

  async function run(fixture: string, interactions = false) {
    current = fixture;
    return audit(url, {
      ...DEFAULT_CONFIG,
      reporters: [],
      maxTabs: 10,
      tabDelay: 20,
      waitAfterLoad: 50,
      interactions: { ...DEFAULT_CONFIG.interactions, enabled: interactions },
    });
  }

  const status = (report: AuditReport, ruleId: string) =>
    report.rules.find((r) => r.ruleId === ruleId)?.status;

  describe("keyboard-trap", () => {
    it.each(["first-control-trap", "mid-page-trap", "last-element-trap"])(
      "fails for %s",
      async (fixture) => {
        const report = await run(fixture);
        expect(status(report, "keyboard-trap")).toBe("failed");
        expect(report.crawl.cycleCompleted).toBe(false);
        const rule = report.rules.find((r) => r.ruleId === "keyboard-trap")!;
        expect(rule.violations.some((v) => v.severity === "error")).toBe(true);
      },
    );

    it("does not flag a trap-free single control as a completed-cycle trap", async () => {
      const report = await run("single-control");
      expect(report.crawl.cycleCompleted).toBe(true);
      expect(status(report, "keyboard-trap")).toBe("passed");
    });

    it("passes when there are no focusable elements", async () => {
      const report = await run("no-focusables");
      expect(report.focusSequence).toHaveLength(0);
      expect(status(report, "keyboard-trap")).toBe("passed");
    });

    it("does not raise focus-order-mismatch noise for a first-stop trap", async () => {
      const report = await run("first-control-trap");
      expect(status(report, "focus-order-mismatch")).toBe("passed");
    });
  });

  describe("unreachable-elements", () => {
    it("flags a role=button without tabindex", async () => {
      const report = await run("unreachable-div-button");
      expect(status(report, "unreachable-elements")).toBe("failed");
    });

    it("ignores disabled and hidden controls", async () => {
      const report = await run("hidden-disabled");
      expect(report.focusSequence.map((e) => e.selector)).toEqual(["#a", "#b"]);
      expect(status(report, "unreachable-elements")).toBe("passed");
    });
  });

  describe("tabindex-abuse", () => {
    it("flags positive tabindex", async () => {
      const report = await run("positive-tabindex");
      expect(status(report, "tabindex-abuse")).toBe("failed");
    });

    it("passes without positive tabindex", async () => {
      const report = await run("single-control");
      expect(status(report, "tabindex-abuse")).toBe("passed");
    });
  });

  describe("missing-focus-indicator", () => {
    it("flags outline:none", async () => {
      const report = await run("no-focus-indicator");
      expect(status(report, "missing-focus-indicator")).toBe("failed");
    });

    it("passes with a visible outline", async () => {
      const report = await run("single-control");
      expect(status(report, "missing-focus-indicator")).toBe("passed");
    });
  });

  describe("skip-link", () => {
    it("passes with a working skip link", async () => {
      const report = await run("skip-link-ok");
      expect(status(report, "skip-link")).toBe("passed");
    });

    it("fails without a skip link", async () => {
      const report = await run("skip-link-missing");
      expect(status(report, "skip-link")).toBe("failed");
    });
  });

  describe("focus-not-obscured", () => {
    it("flags a control covered by an overlay", async () => {
      const report = await run("obscured");
      expect(status(report, "focus-not-obscured")).toBe("failed");
    });
  });

  describe("focus-after-interaction", () => {
    it("fails when the clicked control is removed and focus is lost", async () => {
      const report = await run("focus-lost", true);
      expect(status(report, "focus-after-interaction")).toBe("failed");
    });

    it("passes when focus stays on the control", async () => {
      const report = await run("focus-kept", true);
      expect(status(report, "focus-after-interaction")).toBe("passed");
    });
  });

  describe("roving-tabindex-broken", () => {
    it("passes for a working roving tablist", async () => {
      const report = await run("roving-ok");
      expect(status(report, "roving-tabindex-broken")).toBe("passed");
    });

    it("fails when arrow keys do not move focus", async () => {
      const report = await run("roving-broken");
      expect(status(report, "roving-tabindex-broken")).toBe("failed");
    });
  });

  describe("iframes", () => {
    it("excludes iframe content from the tab order", async () => {
      const report = await run("iframe");
      expect(report.focusSequence.map((e) => e.selector)).toEqual(["#a", "#z"]);
    });
  });
});
