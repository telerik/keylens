# Keylens Telemetry

Keylens can collect anonymous, aggregate usage data to help us understand how
the tool is used and improve it over time. This document explains exactly
what is (and isn't) collected, and how to opt out.

Telemetry is **enabled by default**. A one-time notice is shown the first
time telemetry becomes active, and you can opt out at any time — see
[Notice and opt-out](#notice-and-opt-out) below.

## What is collected

At most one event per audit run (whether from the CLI, the MCP server, or
programmatic library use):

- Keylens/Node.js version, operating system, and how Keylens was invoked
  (CLI, MCP tool, or library)
- Whether the run succeeded, partially succeeded, failed, was aborted, or
  timed out, plus a fixed error category on failure (never the error message)
- Which general options were used (e.g. execution profile, browser engine,
  which reporters, whether interaction testing was enabled) — categories
  only, never your specific values
- Pass/fail status and violation counts per built-in accessibility rule —
  never the violations themselves
- Aggregate crawl statistics (element counts, whether the run completed,
  score, duration)
- A one-way hashed identifier used only to avoid double-counting the same
  install — it cannot be reversed to reveal hardware details or an identity

## What is never collected

URLs, page HTML, CSS selectors, accessible names, screenshots, report
files/content, IP addresses, file paths, or any raw device/hardware details.
Every telemetry event is built from a fixed, reviewed list of fields — there
is no free-form or arbitrary data included.

## Notice and opt-out

The first time telemetry actually becomes active, Keylens shows a one-time
notice (printed to stderr, so it never interferes with `--json` output or
other tooling) explaining what is collected and how to opt out. This notice
is shown at most once.

You can opt out at any time:

- `KEYLENS_TELEMETRY_OFF=1` — disables Keylens telemetry only
- `TELERIK_TELEMETRY_OFF=1` — disables telemetry across Telerik developer
  tools
- `{ telemetry: false }` — a per-call option for programmatic `audit()`
  callers

## Privacy Policy

See Progress's [Privacy Center](https://www.progress.com/legal/privacy-center)
for the full privacy policy.
