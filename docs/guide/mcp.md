# MCP Server

Keylens includes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes keyboard accessibility auditing as tools for AI agents.

## Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "keylens": {
      "command": "npx",
      "args": ["-y", "@telerik/keylens", "mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### VS Code (Copilot / Cursor)

Add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "keylens": {
      "command": "npx",
      "args": ["-y", "@telerik/keylens", "mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### Direct binary

If installed globally, you can use the binary directly:

```json
{
  "mcpServers": {
    "keylens": {
      "command": "keylens-mcp"
    }
  }
}
```

## Available Tools

### `keylens_audit`

Run a keyboard navigation accessibility audit on a single URL.

**Input:**

| Parameter              | Type                                      | Required | Description                                                                  |
| ---------------------- | ----------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `url`                  | string                                    | Yes      | URL to audit                                                                 |
| `options.browser`      | `"chromium"` \| `"firefox"` \| `"webkit"` | No       | Browser engine (default: chromium)                                           |
| `options.viewport`     | `{ width?, height? }`                     | No       | Viewport dimensions                                                          |
| `options.maxTabs`      | number                                    | No       | Maximum tab presses (default: 500)                                           |
| `options.screenshots`  | boolean                                   | No       | Enable screenshot-based focus indicator detection                            |
| `options.interactions` | boolean                                   | No       | Enable post-click interaction testing                                        |
| `options.ai`           | boolean                                   | No       | Enable AI analysis (requires API key)                                        |
| `options.reporters`    | `("cli" \| "json" \| "html" \| "markdown")[]` | No       | Output formats to generate. Use `["html"]` to save an HTML report to disk.   |
| `options.outputDir`    | string                                    | No       | Directory for `json`/`html` report files (default: current working directory)|

**Output:** Full `AuditReport` JSON (screenshots stripped).

#### Generating an HTML report

To write an interactive HTML focus-map report to disk in addition to the JSON response, pass `reporters` and `outputDir`:

```json
{
  "url": "https://example.com",
  "options": {
    "reporters": ["html"],
    "outputDir": "./keylens-report"
  }
}
```

The file is written to `<outputDir>/keylens-report.html`.

### `keylens_audit_multiple`

Audit multiple URLs with cross-page pattern detection.

**Input:**

| Parameter | Type            | Required | Description    |
| --------- | --------------- | -------- | -------------- |
| `urls`    | string[]        | Yes      | URLs to audit  |
| `options` | (same as above) | No       | Shared options (including `reporters` and `outputDir`) |

**Output:** `MultiPageReport` JSON with aggregate summary and cross-page patterns. If `reporters` includes `"html"`, an interactive tabbed multi-page report is also saved to disk.

### `keylens_classify_widgets`

Identify WAI-ARIA APG widget patterns (dialog, menu, tabs, accordion, combobox, disclosure, tooltip) and report expected keyboard behaviors.

Requires an AI API key.

**Input:**

| Parameter | Type   | Required | Description    |
| --------- | ------ | -------- | -------------- |
| `url`     | string | Yes      | URL to analyze |

**Output:** Array of `WidgetClassification` objects with pattern, confidence, and expected keyboard interactions.

### `keylens_validate_focus_order`

Check if the keyboard focus order on a page is logical. Uses vision-based AI analysis when available.

**Input:**

| Parameter | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| `url`     | string | Yes      | URL to validate |

**Output:** `AIFocusOrderResult` with issues and overall assessment, or raw focus sequence if AI is unavailable.

## Zero-Config AI via Sampling

When the MCP client supports **sampling** (e.g. Claude Desktop, Copilot), Keylens can use the client's own AI model for analysis — **no separate API key required**.

The priority chain is automatic:

1. **Direct API key** configured → uses direct API (fastest, no approval prompts)
2. **No key, client supports sampling** → uses the client's model via `sampling/createMessage`
3. **Neither** → returns non-AI results (still useful)

This means MCP users with a Copilot license or Claude Desktop subscription get AI-powered analysis (fix suggestions, focus order validation, widget classification, etc.) out of the box.

## Environment Variables

| Variable             | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `KEYLENS_BROWSER`    | Default browser engine (`chromium`, `firefox`, `webkit`) |
| `KEYLENS_MAX_TABS`   | Default maximum tab presses                              |
| `KEYLENS_AI_KEY`     | AI API key (highest priority)                            |
| `KEYLENS_AI_API_KEY` | AI API key (medium priority)                             |
| `ANTHROPIC_API_KEY`  | AI API key (lowest priority)                             |

## Transport

The MCP server uses **stdio transport** (JSON-RPC over stdin/stdout). All diagnostic output goes to stderr.
