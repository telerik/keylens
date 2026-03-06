# CLI Reference

## Commands

### `keylens audit [url]`

Run a keyboard navigation audit on one or more URLs. The URL argument is optional — when omitted, Keylens reads URLs from the config file's `urls` array.

| Flag                       | Default            | Description                                                    |
| -------------------------- | ------------------ | -------------------------------------------------------------- |
| `-c, --config <path>`      | —                  | Path to config file                                            |
| `-o, --output <reporters>` | `cli`              | Reporters (comma-separated: `cli`, `json`, `html`, `markdown`) |
| `-d, --output-dir <dir>`   | `./keylens-report` | Output directory for reports                                   |
| `-b, --browser <name>`     | `chromium`         | Browser engine: `chromium`, `firefox`, `webkit`                |
| `--headed`                 | `false`            | Run with a visible browser window                              |
| `--wait-for <selector>`    | —                  | Wait for CSS selector before auditing                          |
| `--wait <ms>`              | `1000`             | Wait after page load (ms)                                      |
| `--max-tabs <n>`           | `500`              | Max Tab presses before stopping                                |
| `--tab-delay <ms>`         | `250`              | Delay between tab presses in ms (min: 10)                      |
| `--viewport <WxH>`         | `1280x720`         | Viewport dimensions                                            |
| `--timeout <ms>`           | `30000`            | Navigation timeout in ms                                       |
| `--screenshots`            | `false`            | Capture per-element focused/unfocused screenshots              |
| `--interactions`           | `false`            | Test focus behavior after clicking buttons                     |
| `--ai`                     | `false`            | Enable AI analysis                                             |
| `--ai-model <model>`       | —                  | AI model to use (overrides config)                             |
| `-q, --quiet`              | `false`            | Suppress non-essential output                                  |
| `-v, --verbose`            | `false`            | Enable debug output                                            |

#### `--screenshots`

When enabled, Keylens captures per-element screenshots during the tab crawl:

- **Focused screenshot** — taken immediately after each element receives focus
- **Unfocused screenshot** — taken of the previous element (which just lost focus)

These pairs are compared pixel-by-pixel using [pixelmatch](https://github.com/mapbox/pixelmatch). If no visible difference is found (below a 1% threshold), the element is flagged as missing a focus indicator with **Error** severity — providing stronger evidence than the CSS heuristic alone.

```bash
keylens audit https://example.com --screenshots
```

#### `--interactions`

When enabled, Keylens clicks buttons and `role="button"` elements after the tab crawl and verifies that focus isn't lost (i.e., doesn't revert to `<body>`). Links are skipped to avoid navigation, and `type="submit"` inputs are skipped to avoid form submission.

Each element where focus is lost produces an **Error**-severity violation under the `focus-after-interaction` rule (WCAG 2.4.3, 2.4.7).

```bash
keylens audit https://example.com --interactions
```

Combine with other flags:

```bash
keylens audit https://example.com --interactions --screenshots --output html
```

#### `--tab-delay`

Controls the delay (in milliseconds) between consecutive Tab key presses during the crawl. The default is 250ms. The minimum accepted value is 10ms.

```bash
# Slower tabbing for complex pages with animations
keylens audit https://example.com --tab-delay 500

# Faster tabbing for simple pages
keylens audit https://example.com --tab-delay 50
```

#### Markdown Reporter

Use `--output markdown` (or `-o markdown`) to generate a Markdown report file (`keylens-report.md` for single-page, `keylens-report-multi.md` for multi-page audits).

```bash
keylens audit https://example.com --output markdown

# Combine with other reporters
keylens audit https://example.com --output cli,markdown
```

## Multi-Page Scanning

When multiple URLs are configured, Keylens audits each page sequentially and produces an aggregate report.

Using a config file with multiple URLs:

```bash
# keylens.config.json has urls: ["https://example.com", "https://example.com/about"]
keylens audit --config keylens.config.json --output html
```

Or pass a single URL directly:

```bash
keylens audit https://example.com
```

When a single URL is passed as an argument, it takes precedence over the config file's `urls` array.

Multi-page reports include:

- **CLI**: each page printed separately, followed by an aggregate summary
- **JSON**: single file containing all page reports with aggregate totals
- **HTML**: tabbed interface with per-page sections, each with its own focus order map
- **Markdown**: single file with per-page sections and aggregate summary

### `keylens init`

Generate a `keylens.config.json` in the current directory.

### `keylens mcp`

Start the Keylens MCP server over stdio. Used by AI agents (Claude Desktop, VS Code Copilot, Cursor) to run keyboard accessibility audits. See [MCP Server](/guide/mcp) for setup instructions.

## Exit Codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| `0`  | Audit passed (no errors)                 |
| `1`  | Audit found errors                       |
| `2`  | Audit failed to run (crash/config error) |
