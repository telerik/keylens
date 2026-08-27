# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Execution profiles (`fast`, `balanced`, and `thorough`)
- Enforced capture, interaction, phase-timeout, and cancellation budgets
- Structured progress events, typed operational errors, and stable CLI exit codes
- Staged deterministic, experimental enrichment, and explicit rendering APIs
- Asset projection modes and browser-safe `@telerik/keylens/guidance`
- Report schema versioning, deterministic scores, and incomplete-score indicators
- Support, security, performance, and limitations documentation
- Cross-browser CI, coverage thresholds, benchmark budgets, and packed-consumer checks
- `keylens_get_rule_guidance` MCP tool: static rule remediation lookup (WCAG references,
  guidance, code example, config key)

### Changed

- Programmatic audits are silent and in-memory unless rendering is explicitly requested
- Configuration accepts nested partial input and rejects unknown keys
- Page screenshots are independent from bounded focus-state screenshot pairs
- Interaction results distinguish passed, failed, skipped, and errored cases
- MCP and the bundled agent skill are explicitly experimental
- Documentation reflects GitHub Packages distribution; no public npm or `1.0.0`
  availability is announced

### Removed

- Legacy `captureElementScreenshots` and boolean `interactions` config shapes
- MCP sampling and the `--screenshots` per-element capture option
- Multi-page auditing (`auditMultiple()`, multi-page CLI/MCP options, and multi-page report variants) in favor of a single-page-per-invocation contract

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
- MCP server for agent integration (`keylens-mcp` binary, stdio transport)
- MCP tools: `keylens_audit`, `keylens_audit_multiple`, `keylens_classify_widgets`, `keylens_validate_focus_order`
- `keylens mcp` CLI subcommand to start the MCP server
- Agent Skill (`/keylens`) for Claude Code and compatible agent platforms
- `@modelcontextprotocol/sdk` and `zod` dependencies
