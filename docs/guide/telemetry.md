# Telemetry and privacy

Keylens can collect anonymous, aggregate usage data to help improve the tool.
Telemetry is enabled by default, and a one-time notice explains what is collected
when telemetry becomes active. You can opt out at any time.

## What is collected

At most one event is sent per audit run, whether the audit uses the CLI, MCP server,
or programmatic API:

- Keylens and Node.js versions, operating system, and invocation surface
- Outcome category, such as success, partial, failure, aborted, or timed out
- General configuration categories, such as execution profile, browser, reporters,
  and whether interaction testing was enabled
- Pass/fail status and violation counts for each built-in rule
- Aggregate crawl statistics, completion state, score, and duration
- A one-way hashed identifier used only to avoid double-counting an installation

## What is never collected

Keylens never sends URLs, page HTML, CSS selectors, accessible names, screenshots,
report content, IP addresses, file paths, or raw device and hardware details.
Telemetry events are built from a fixed allow-list of fields; arbitrary data is not
included.

## Notice and opt out

The one-time notice is printed to stderr, so it does not interfere with JSON output
or other command-line tooling.

Disable telemetry with any of these options:

- `KEYLENS_TELEMETRY_OFF=1` disables Keylens telemetry.
- `TELERIK_TELEMETRY_OFF=1` disables telemetry across Telerik developer tools.
- `{ telemetry: false }` disables telemetry for a programmatic `audit()` call.

For the full privacy policy, see Progress's
[Privacy Policy](https://www.progress.com/legal/privacy-policy).
