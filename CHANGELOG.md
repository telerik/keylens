# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-20

### Added

- CLI with `audit` and `init` commands
- Programmatic API: `audit()` and `auditMultiple()`
- Tab crawling with Playwright (chromium, firefox, webkit)
- Configurable tab delay (`--tab-delay <ms>` CLI option, `tabDelay` config key, default 250ms, min 10ms)
- 8 accessibility rules: keyboard-trap, unreachable-elements, focus-order-mismatch, tabindex-abuse, missing-focus-indicator, skip-link, focus-not-obscured, focus-after-interaction
- 4 reporters: CLI (terminal), JSON (CI-friendly), HTML (visual focus map overlay), Markdown (LLM-friendly)
- Per-element screenshot diffing for focus indicator detection
- Skip link functional testing
- Post-click interaction testing
- Multi-page scanning with aggregate reports
- ARIA attributes (`ariaAttributes`) and parent landmark context (`parentContext`) on `FocusedElement`
- Rule metadata (`ruleName`, `ruleDescription`, `wcag`) on `RuleResult` for richer external consumption
- MCP server for AI agent integration (`keylens-mcp` binary, stdio transport)
- MCP tools: `keylens_audit`, `keylens_audit_multiple`, `keylens_classify_widgets`, `keylens_validate_focus_order`
- `keylens mcp` CLI subcommand to start the MCP server
- Agent Skill (`/keylens`) for Claude Code and compatible agent platforms
- MCP sampling support: AI features work without a separate API key when the MCP client supports sampling (e.g. Copilot, Claude Desktop)
- `AITransport` interface for pluggable AI providers
- `@modelcontextprotocol/sdk` and `zod` dependencies
- AI-powered analysis (optional, requires Anthropic API key):
  - Vision-based focus order validation
  - Structured fix suggestions with before/after code
  - Widget classification by APG pattern
  - Accessible name inference
  - Focus indicator quality scoring
  - Natural language report summaries
  - Cross-page pattern detection
