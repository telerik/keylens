# MCP server

The Model Context Protocol server uses
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

| Tool                        | Purpose                              |
| --------------------------- | ------------------------------------ |
| `keylens_audit`             | Single-page audit and compact report |
| `keylens_get_rule_guidance` | Rule remediation guidance lookup     |

`keylens_get_rule_guidance` takes an optional `ruleId` (e.g. `missing-focus-indicator`,
usually copied from an audit violation). Omit it to list every rule. Each entry
includes the WCAG references, human-readable guidance, a code example, and the
`configKey` used to enable/disable the rule via `rules` config. No browser or AI is
involved — it's a static lookup.

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

Compact responses omit image assets, echoed config, geometry, element HTML, and other
large fields. File reporters contain their normal output.

## Environment variables

| Variable                                                                 | Purpose               |
| ------------------------------------------------------------------------ | --------------------- |
| `KEYLENS_BROWSER`                                                        | MCP default browser   |
| `KEYLENS_MAX_TABS`                                                       | MCP default Tab limit |
| Use the normal config or CLI for options not exposed by the MCP adapter. |
