# Experimental agent skill

The package includes an experimental, user-invokable `keylens` agent skill under
`skill/`. The skill and agent workflows are outside the stable core contract.

```text
skill/
  SKILL.md
  references/
    rules.md
    fix-patterns.md
```

The skill gives compatible coding agents a compact workflow for:

- running CLI audits and saving JSON;
- choosing screenshot or interaction evidence;
- reading summary, crawl coverage, and per-rule results;
- applying rule-specific remediation patterns;
- rerunning the deterministic audit after changes.

## Use safely

Before asking an agent to audit:

1. install Keylens from GitHub Packages and install the selected Playwright browser;
2. start the target application yourself;
3. use a test environment without production secrets or customer data;
4. keep interactions disabled unless the target controls and limits are known safe;
5. review code changes and rerun tests manually.

If the agent uses MCP, configure the [experimental MCP server](./mcp). Otherwise it can
invoke the locally installed `keylens` binary through a terminal.

```text
Audit http://127.0.0.1:3000 with Keylens. Save JSON, explain incomplete
coverage separately from accessibility failures, and propose fixes without
enabling interactions or AI.
```

Agents must distinguish exit code `1` (accessibility findings) from `2` (incomplete
audit), and must not treat warnings, AI suggestions, or a score as conformance proof.
See [Known limitations](./limitations).
