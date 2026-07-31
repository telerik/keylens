# Experimental MCP server

The Model Context Protocol server and its tool contracts are experimental. It uses
stdio, starts through `keylens mcp`, `keylens-mcp`, or the
`@telerik/keylens/mcp` package subpath, and writes protocol data only to stdout.

## Installation

Install Keylens and Chromium first. Because distribution is through GitHub Packages,
the MCP client's process must be able to read your authenticated npm configuration.
Prefer a project or global installation over asking an agent to download an unpinned
package on every run.

```json
{
  "mcpServers": {
    "keylens": {
      "command": "keylens-mcp"
    }
  }
}
```

If the client requires `npx`, configure the `@telerik` registry and authentication
before starting the client:

```json
{
  "mcpServers": {
    "keylens": {
      "command": "npx",
      "args": ["-y", "@telerik/keylens@dev", "mcp"]
    }
  }
}
```

Do not place API keys directly in a checked-in MCP configuration.

## Tools

| Tool                           | Purpose                                    |
| ------------------------------ | ------------------------------------------ |
| `keylens_audit`                | Single-page audit and compact report       |
| `keylens_audit_multiple`       | Multi-page audit and compact aggregate     |
| `keylens_classify_widgets`     | AI widget classification                   |
| `keylens_validate_focus_order` | AI analysis or raw focus sequence fallback |

The two audit tools accept:

| Option            | Type                                       |
| ----------------- | ------------------------------------------ |
| `profile`         | `fast`, `balanced`, or `thorough`          |
| `browser`         | `chromium`, `firefox`, or `webkit`         |
| `viewport`        | partial `{ width, height }`                |
| `maxTabs`         | positive integer                           |
| `tabDelay`        | number, minimum 10                         |
| `waitForSelector` | nonempty string                            |
| `waitAfterLoad`   | nonnegative number                         |
| `screenshots`     | boolean                                    |
| `interactions`    | boolean                                    |
| `ai`              | boolean                                    |
| `reporters`       | array of `cli`, `json`, `html`, `markdown` |
| `outputDir`       | string                                     |

MCP does not currently expose the complete stable config surface, including capture
limits, phase timeouts, interaction policy, page capture mode, or multi-page
concurrency. Use the CLI or library when those controls are required.

By default, MCP returns a compact semantic response and writes nothing. Passing
`reporters` opts into reporter side effects; `outputDir` defaults to
`./keylens-report` under the server's working directory.

```json
{
  "url": "https://example.com",
  "options": {
    "profile": "balanced",
    "reporters": ["json"],
    "outputDir": "./keylens-report"
  }
}
```

Compact responses omit image assets, echoed config, geometry, element HTML, and other
large fields. File reporters contain their normal output.

## AI and sampling

Direct API credentials take priority. Without a direct key, a client advertising MCP
sampling receives `sampling/createMessage` requests and can provide the model. If
neither is available, the audit tools still return deterministic data;
`keylens_classify_widgets` reports that AI is unavailable, and focus-order validation
returns the raw sequence.

Sampling can prompt for approval and sends audit context to the MCP client's selected
model. The same nondeterminism and data-handling cautions in [Experimental AI](./ai)
apply.

## Environment variables

| Variable              | Purpose                           |
| --------------------- | --------------------------------- |
| `KEYLENS_BROWSER`     | MCP default browser               |
| `KEYLENS_MAX_TABS`    | MCP default Tab limit             |
| `KEYLENS_AI_API_KEY`  | Provider-neutral AI key           |
| `ANTHROPIC_API_KEY`   | Anthropic key fallback            |
| `OPENAI_API_KEY`      | OpenAI key fallback               |
| `KEYLENS_AI_BASE_URL` | Custom/OpenAI-compatible base URL |

Use the normal config or CLI for options not exposed by the MCP adapter.
