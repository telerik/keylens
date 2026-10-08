# Agent skill integration

The package includes an optional, user-invokable `keylens` agent skill under
`skill/`. The skill and agent workflows are separate from the stable core contract.

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

## Install the skill

The skill ships inside the npm package, so after `npm install @progress/keylens` it is
available at `node_modules/@progress/keylens/skill/`. Agents do not look there; copy
the whole folder (including `references/`) into a location the agent scans for skills,
naming the target folder `keylens` to match the `name` in `SKILL.md`:

```bash
# Project-level (shared with the repo)
mkdir -p .github/skills
cp -R node_modules/@progress/keylens/skill .github/skills/keylens

# Or user-level (all projects)
mkdir -p ~/.copilot/skills
cp -R node_modules/@progress/keylens/skill ~/.copilot/skills/keylens
```

Common discovery locations are `.github/skills/<name>/`, `.claude/skills/<name>/`, and
`.agents/skills/<name>/` in a project, and `~/.copilot/skills/`, `~/.claude/skills/`, or
`~/.agents/skills/` per user. Check your agent's documentation for the exact paths it
supports, and re-copy after upgrading Keylens to pick up skill changes.

## Use safely

Before asking an agent to audit:

1. install Keylens from npm and install the selected Playwright browser;
2. start the target application yourself;
3. use a test environment without production secrets or customer data;
4. keep interactions disabled unless the target controls and limits are known safe;
5. review code changes and rerun tests manually.

If the agent uses MCP, configure the [optional MCP server](./mcp). Otherwise it can
invoke the locally installed `keylens` binary through a terminal.

```text
Audit http://127.0.0.1:3000 with Keylens. Save JSON, explain incomplete
coverage separately from accessibility failures, and propose fixes without
enabling interactions.
```

Agents must distinguish exit code `1` (accessibility findings) from `2` (incomplete
audit), and must not treat warnings or a score as conformance proof.
See [Known limitations](./limitations).
