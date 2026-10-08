# MCP server

The Model Context Protocol server uses stdio and is exposed as a separate executable
`keylens-mcp` from the main `@progress/keylens` package. It writes protocol data only to stdout.

## Installation

Install Keylens and Chromium first. Prefer a project or global installation over
asking an agent to download an unpinned package on every run.

```bash
npm install @progress/keylens
```

Then configure your MCP client to start the server:

```json
{
  "mcpServers": {
    "keylens": {
      "command": "keylens-mcp"
    }
  }
}
```

If the client requires `npx` and you prefer not to install the package locally:

```json
{
  "mcpServers": {
    "keylens": {
      "command": "npx",
      "args": ["-y", "-p", "@progress/keylens", "keylens-mcp"]
    }
  }
}
```

## Tools

| Tool                        | Purpose                              |
| --------------------------- | ------------------------------------ |
| `keylens_audit`             | Single-page audit and compact report |
| `keylens_get_rule_guidance` | Rule remediation guidance lookup     |

`keylens_get_rule_guidance` takes an optional `ruleId` (e.g. `missing-focus-indicator`,
usually copied from an audit violation). Omit it to list every rule. Each entry
includes the WCAG references, human-readable guidance, a code example, and the
`configKey` used to enable/disable the rule via `rules` config. No browser is involved —
it's a static lookup.

The audit tool accepts:

| Option             | Type                                                         |
| ------------------ | ------------------------------------------------------------ |
| `profile`          | `fast`, `balanced`, or `thorough`                            |
| `browser`          | `chromium`, `firefox`, or `webkit`                           |
| `viewport`         | partial `{ width, height }`                                  |
| `maxTabs`          | positive integer                                             |
| `tabDelay`         | number, minimum 10                                           |
| `waitForSelector`  | nonempty string                                              |
| `waitAfterLoad`    | nonnegative number                                           |
| `interactions`     | boolean                                                      |
| `keepOverlays`     | boolean — disable auto-dismissing cookie/consent banners     |
| `dismissSelectors` | array of strings — extra selectors to click before the crawl |
| `reporters`        | array of `cli`, `json`, `html`, `markdown`                   |
| `outputDir`        | string                                                       |
| `outputFileName`   | string                                                       |

By default, the prepare phase auto-dismisses known cookie/consent banners (built-in
CMP presets + a generic heuristic fallback) before the crawl, preferring the reject
action. Set `keepOverlays: true` to disable this, or `dismissSelectors` to also click
custom selectors. `consentPreference` and generic `steps`/`cookies` are not yet exposed
over MCP — use the CLI or library config for those. See
[Configuration](./configuration#prepare).

MCP does not currently expose the complete stable config surface, including capture
limits, phase timeouts, interaction policy, or page capture mode. Use the CLI or
library when those controls are required.

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

The `cli` reporter prints its human-readable report to the server's stderr, never stdout,
so the stdio protocol stays clean; it is not included in the tool result.

Compact responses omit image assets, echoed config, geometry, element HTML, and other
large fields. File reporters contain their normal output.

## Environment variables

| Variable           | Purpose               |
| ------------------ | --------------------- |
| `KEYLENS_BROWSER`  | MCP default browser   |
| `KEYLENS_MAX_TABS` | MCP default Tab limit |

Use the normal config or CLI for options not exposed by the MCP adapter.
