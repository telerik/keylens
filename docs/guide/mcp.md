# MCP server

The Model Context Protocol server uses stdio and is exposed as a separate executable
`keylens-mcp` from the main `@progress/keylens` package. It writes protocol data only to stdout.

## Installation

Install Keylens and Chromium first. Prefer a project or global installation over
asking an agent to download an unpinned package on every run.

```bash
npm install @progress/keylens
npx playwright install chromium
```

A local install does not put `keylens-mcp` on your MCP client's `PATH`, so a bare
`"command": "keylens-mcp"` fails with `ENOENT`. Run the project-local binary through
`npx` (set `cwd` if your client does not start in the project root):

```json
{
  "mcpServers": {
    "keylens": {
      "command": "npx",
      "args": ["--no-install", "keylens-mcp"]
    }
  }
}
```

Alternatively, use the absolute path to the installed binary, e.g.
`/path/to/project/node_modules/.bin/keylens-mcp`. After a global install
(`npm install -g @progress/keylens`), `"command": "keylens-mcp"` works as-is.

If you prefer not to install the package locally (Chromium must still be installed
with `npx playwright install chromium`):

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

Compact responses omit image assets, echoed config, geometry, element HTML, and other
large fields. File reporters contain their normal output.

## Environment variables

| Variable           | Purpose               |
| ------------------ | --------------------- |
| `KEYLENS_BROWSER`  | MCP default browser   |
| `KEYLENS_MAX_TABS` | MCP default Tab limit |

Use the normal config or CLI for options not exposed by the MCP adapter.
