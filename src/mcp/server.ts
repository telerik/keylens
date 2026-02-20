import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { setLogLevel } from "../utils/logger.js";
import {
  handleAudit,
  handleAuditMultiple,
  handleClassifyWidgets,
  handleValidateFocusOrder,
} from "./handlers.js";

declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev";

// Silence stdout logging — MCP uses stdio for JSON-RPC
setLogLevel("silent");

const server = new McpServer({
  name: "keylens",
  version: VERSION,
});

// ─── Shared Schemas ─────────────────────────────────────────────

const auditOptionsSchema = z
  .object({
    browser: z.enum(["chromium", "firefox", "webkit"]).optional(),
    viewport: z
      .object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .optional(),
    maxTabs: z.number().int().positive().optional(),
    waitForSelector: z.string().optional(),
    waitAfterLoad: z.number().int().nonnegative().optional(),
    screenshots: z.boolean().optional(),
    interactions: z.boolean().optional(),
    ai: z.boolean().optional(),
    reporters: z
      .array(z.enum(["cli", "json", "html"]))
      .optional()
      .describe(
        'Output report formats to generate. Supported values: "cli", "json", "html". ' +
        'Use "html" to save an interactive HTML focus-map report to disk.',
      ),
    outputDir: z
      .string()
      .optional()
      .describe(
        "Directory where json/html report files will be written. Defaults to the current working directory.",
      ),
  })
  .optional();

// ─── Tool Registration ──────────────────────────────────────────

server.registerTool(
  "keylens_audit",
  {
    description:
      "Run a keyboard navigation accessibility audit on a single URL. " +
      "Launches a real browser, tabs through the page, and reports keyboard traps, " +
      "unreachable elements, focus order issues, missing focus indicators, and more.",
    inputSchema: {
      url: z.string().url().describe("The URL to audit"),
      options: auditOptionsSchema,
    },
  },
  async ({ url, options }) => handleAudit({ url, options }, server.server),
);

server.registerTool(
  "keylens_audit_multiple",
  {
    description:
      "Run keyboard navigation audits on multiple URLs and produce an aggregate report " +
      "with cross-page pattern detection.",
    inputSchema: {
      urls: z.array(z.string().url()).min(1).describe("URLs to audit"),
      options: auditOptionsSchema,
    },
  },
  async ({ urls, options }) =>
    handleAuditMultiple({ urls, options }, server.server),
);

server.registerTool(
  "keylens_classify_widgets",
  {
    description:
      "Identify WAI-ARIA APG widget patterns (dialog, menu, tabs, accordion, combobox, " +
      "disclosure, tooltip) on a page and report expected keyboard behaviors for each. " +
      "Uses the client's AI model via sampling when available, or requires an API key.",
    inputSchema: {
      url: z.string().url().describe("The URL to analyze"),
    },
  },
  async ({ url }) => handleClassifyWidgets({ url }, server.server),
);

server.registerTool(
  "keylens_validate_focus_order",
  {
    description:
      "Check if the keyboard focus order on a page is logical. Uses vision-based AI " +
      "analysis when available, otherwise returns the raw focus sequence. " +
      "Uses the client's AI model via sampling when available, or requires an API key.",
    inputSchema: {
      url: z.string().url().describe("The URL to validate"),
    },
  },
  async ({ url }) => handleValidateFocusOrder({ url }, server.server),
);

// ─── Start Server ───────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Keylens MCP server v${VERSION} started`);
}

main().catch((error) => {
  console.error("Failed to start Keylens MCP server:", error);
  process.exit(1);
});
