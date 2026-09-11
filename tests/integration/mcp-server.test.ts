/**
 * Spawns the real MCP server entry point (src/mcp/server.ts) over stdio using the
 * actual @modelcontextprotocol/sdk client, exactly how an agent host would connect.
 * Nothing else exercises the server end-to-end — tests/unit/mcp/handlers.test.ts only
 * calls handleAudit/handleGetRuleGuidance as plain functions, never through the
 * registered tool schemas or the stdio transport itself.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const MCP_SERVER_ENTRY = resolve(
  import.meta.dirname,
  "../../src/mcp/server.ts",
);
const TSX_CLI = resolve(
  import.meta.dirname,
  "../../node_modules/tsx/dist/cli.mjs",
);
const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures");

function serveFixture(
  fileName: string,
): Promise<{ server: Server; url: string }> {
  const html = readFileSync(join(FIXTURES_DIR, fileName), "utf-8");
  return new Promise((resolvePromise) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolvePromise({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function textOf(result: { content: Array<{ type: string; text?: string }> }) {
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
}

describe("Integration: MCP server (stdio)", () => {
  let cleanServer: Server;
  let cleanUrl: string;
  let badServer: Server;
  let badUrl: string;
  let client: Client;

  beforeAll(async () => {
    ({ server: cleanServer, url: cleanUrl } =
      await serveFixture("clean-page.html"));
    ({ server: badServer, url: badUrl } = await serveFixture("test-page.html"));

    client = new Client({ name: "keylens-test-client", version: "0.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [TSX_CLI, MCP_SERVER_ENTRY],
    });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client?.close();
    cleanServer?.close();
    badServer?.close();
  });

  it("advertises exactly the two documented tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["keylens_audit", "keylens_get_rule_guidance"]);
  });

  it("audits a clean page and reports no errors", async () => {
    const result = await client.callTool({
      name: "keylens_audit",
      arguments: {
        url: cleanUrl,
        options: { profile: "fast" },
      },
    });

    expect(result.isError).toBeFalsy();
    const report = JSON.parse(textOf(result as never));
    expect(report.url).toBe(cleanUrl);
    expect(report.summary.totalErrors).toBe(0);
  });

  it("audits a page with known issues and reports violations", async () => {
    const result = await client.callTool({
      name: "keylens_audit",
      arguments: {
        url: badUrl,
        options: { profile: "fast" },
      },
    });

    expect(result.isError).toBeFalsy();
    const report = JSON.parse(textOf(result as never));
    expect(report.summary.totalErrors).toBeGreaterThan(0);
    // Compact report contract: passing rules are stripped of their (empty) violations,
    // screenshots/outerHTML/style snapshots are never present.
    expect(JSON.stringify(report)).not.toMatch(/boundingRect|pageRect/);
  });

  it("returns an error result instead of throwing for an unreachable URL", async () => {
    const result = await client.callTool({
      name: "keylens_audit",
      arguments: {
        url: "http://127.0.0.1:1",
        options: { profile: "fast" },
      },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result as never)).toMatch(/audit failed/i);
  });

  it("looks up guidance for a known rule id", async () => {
    const result = await client.callTool({
      name: "keylens_get_rule_guidance",
      arguments: { ruleId: "keyboard-trap" },
    });

    expect(result.isError).toBeFalsy();
    const guidance = JSON.parse(textOf(result as never));
    expect(guidance.ruleId).toBe("keyboard-trap");
    expect(guidance.configKey).toBe("keyboardTrap");
    expect(Array.isArray(guidance.wcag)).toBe(true);
  });

  it("lists every rule's guidance when ruleId is omitted", async () => {
    const result = await client.callTool({
      name: "keylens_get_rule_guidance",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const rules = JSON.parse(textOf(result as never));
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThanOrEqual(9);
  });

  it("returns an error result for an unknown rule id", async () => {
    const result = await client.callTool({
      name: "keylens_get_rule_guidance",
      arguments: { ruleId: "not-a-real-rule" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result as never)).toMatch(/unknown rule/i);
  });

  it("returns an MCP error result for an invalid URL argument", async () => {
    const result = await client.callTool({
      name: "keylens_audit",
      arguments: { url: "not-a-url" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result as never)).toMatch(/invalid/i);
  });

  it("rejects options outside the documented MCP surface (capture, timeouts)", async () => {
    // Docs promise MCP does not expose capture limits, phase timeouts, interaction
    // policy, or page capture mode — confirm the tool schema's .strict() actually
    // enforces that instead of silently accepting/ignoring the extra fields.
    const result = await client.callTool({
      name: "keylens_audit",
      arguments: {
        url: cleanUrl,
        options: { capture: { page: "full" } },
      },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result as never)).toMatch(/invalid/i);
  });

  it("rejects an unrecognized top-level option key", async () => {
    const result = await client.callTool({
      name: "keylens_audit",
      arguments: {
        url: cleanUrl,
        options: { timeouts: { total: 1000 } },
      },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result as never)).toMatch(/invalid/i);
  });
});
