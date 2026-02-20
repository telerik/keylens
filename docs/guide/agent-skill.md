# Agent Skill

Keylens ships with an agent skill for Claude Code and compatible agent platforms. The `/keylens` skill provides guided keyboard accessibility auditing workflows.

## What's included

The skill files are bundled in the npm package under `skill/`:

```
skill/
  SKILL.md              # Skill definition with instructions
  references/
    rules.md            # Condensed reference for all 8 rules
    fix-patterns.md     # Code-level fix patterns by rule
```

## Using with Claude Code

When the Keylens MCP server is configured, you can ask Claude Code to run keyboard accessibility audits directly:

> "Run a keylens audit on `http://localhost:3000` and fix any issues"

The agent will use the MCP tools to audit the page and apply fixes based on the structured results.

## Skill Contents

### SKILL.md

The main skill file includes:

- Installation verification
- Common audit workflows (basic, AI-enabled, screenshots, multi-page)
- How to interpret JSON results
- Quick-reference table of all 8 rules
- Exit code semantics

### references/rules.md

Condensed reference for each rule:

- Rule ID and WCAG criterion
- What it detects
- Common causes
- How to fix

### references/fix-patterns.md

Ready-to-use code snippets organized by rule:

- Keyboard trap: Escape key handlers
- Unreachable elements: Native elements and tabindex
- Focus indicators: `:focus-visible` CSS
- Skip links: HTML and CSS patterns
- Focus management: Post-interaction focus handling
