/**
 * Static drift checks between user-facing docs (README/guides/skill) and the
 * actual CLI flags / rule IDs implemented in source. These are text/regex
 * checks against source files, not runtime behavior — deliberately cheap and
 * fast so doc drift (a flag renamed/removed, a new flag left undocumented, a
 * rule ID typo) fails CI immediately instead of silently confusing users, the
 * same class of problem that caused the GitHub-Packages-vs-npm confusion this
 * investigation started from.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { RULE_CONFIG_MAP } from "@/rules/index.js";
import { getRuleCatalog } from "@/guidance.js";

const root = resolve(import.meta.dirname, "../..");
const read = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), "utf-8");

const cliSource = read("src/cli/index.ts");
const readme = read("README.md");
const cliDocs = read("docs/guide/cli.md");
const ciCdDocs = read("docs/guide/ci-cd.md");
const gettingStartedDocs = read("docs/guide/getting-started.md");
const configDocs = read("docs/guide/configuration.md");
const visionDocs = read("docs/VISION.md");
const skillDoc = read("skill/SKILL.md");
const mcpDocs = read("docs/guide/mcp.md");
const rulesIndexDoc = read("docs/rules/index.md");
const mcpServerSource = read("src/mcp/server.ts");

/** Every long-form `--flag-name` registered as a Commander `.option(...)` call. */
function extractRegisteredCliFlags(source: string): Set<string> {
  const flags = new Set<string>([
    // Commander adds these to every (sub)command automatically; they never
    // appear as explicit `.option(...)` calls in src/cli/index.ts.
    "--version",
    "--help",
  ]);
  const optionCallPattern = /\.option\(\s*"([^"]+)"/g;
  for (const match of source.matchAll(optionCallPattern)) {
    const spec = match[1]!;
    for (const flagMatch of spec.matchAll(/--[a-zA-Z][a-zA-Z-]*/g)) {
      flags.add(flagMatch[0]);
    }
  }
  return flags;
}

/**
 * Every long-form `--flag-name` mentioned anywhere in a doc's prose or code
 * blocks. Ignores wildcard prose references like `--no-*` (describing a
 * pattern, not a literal flag) and flags belonging to other tools invoked in
 * the same docs (gh/npm/playwright), which are not part of Keylens's surface.
 */
const NON_KEYLENS_TOOL_FLAGS = new Set([
  "--scopes", // gh auth login
  "--save-dev", // npm install
  "--with-deps", // npx playwright install
]);

function extractMentionedCliFlags(source: string): Set<string> {
  const flags = new Set<string>();
  for (const match of source.matchAll(/--[a-zA-Z][a-zA-Z-]*\*?/g)) {
    const flag = match[0];
    if (flag.endsWith("*")) continue; // e.g. "--no-*" wildcard prose reference
    if (NON_KEYLENS_TOOL_FLAGS.has(flag)) continue;
    flags.add(flag);
  }
  return flags;
}

describe("docs drift: CLI flags", () => {
  const registeredFlags = extractRegisteredCliFlags(cliSource);

  it("finds a nonempty set of registered CLI flags (sanity check on the extractor)", () => {
    expect(registeredFlags.size).toBeGreaterThan(10);
    expect(registeredFlags.has("--profile")).toBe(true);
    expect(registeredFlags.has("--interactions")).toBe(true);
  });

  const docSources: Record<string, string> = {
    "README.md": readme,
    "docs/guide/cli.md": cliDocs,
    "docs/guide/ci-cd.md": ciCdDocs,
    "docs/guide/getting-started.md": gettingStartedDocs,
    "docs/guide/configuration.md": configDocs,
    "docs/VISION.md": visionDocs,
    "skill/SKILL.md": skillDoc,
  };

  for (const [docName, docSource] of Object.entries(docSources)) {
    it(`every --flag mentioned in ${docName} is a real, registered CLI flag`, () => {
      const mentioned = extractMentionedCliFlags(docSource);
      const unknownFlags = [...mentioned].filter(
        (flag) => !registeredFlags.has(flag),
      );
      expect(unknownFlags).toEqual([]);
    });
  }

  it("every registered CLI flag is documented somewhere (README, CLI guide, or skill)", () => {
    // Commander's auto-generated --help is self-explanatory and conventionally
    // left out of usage docs; everything else must be documented explicitly.
    const selfDocumenting = new Set(["--help"]);
    const documented = new Set([
      ...extractMentionedCliFlags(readme),
      ...extractMentionedCliFlags(cliDocs),
      ...extractMentionedCliFlags(skillDoc),
    ]);
    const undocumentedFlags = [...registeredFlags].filter(
      (flag) => !documented.has(flag) && !selfDocumenting.has(flag),
    );
    expect(undocumentedFlags).toEqual([]);
  });
});

describe("docs drift: rule IDs", () => {
  const realRuleIds = new Set(Object.keys(RULE_CONFIG_MAP));

  it("finds a nonempty set of real rule IDs (sanity check)", () => {
    expect(realRuleIds.size).toBeGreaterThanOrEqual(9);
  });

  it("every rule ID in docs/rules/index.md's table is a real, registered rule", () => {
    const mentionedIds = [...rulesIndexDoc.matchAll(/`([a-z][a-z-]*)`/g)].map(
      (m) => m[1]!,
    );
    // Filter out inline code that isn't a rule id (e.g. config-key examples).
    const candidateRuleIds = mentionedIds.filter((id) => id.includes("-"));
    const unknownIds = candidateRuleIds.filter((id) => !realRuleIds.has(id));
    expect(unknownIds).toEqual([]);
  });

  it("every rule listed in docs/rules/index.md's table is present, and nothing real is missing", () => {
    for (const ruleId of realRuleIds) {
      expect(rulesIndexDoc).toContain(`\`${ruleId}\``);
    }
  });

  it("every rule ID in skill/SKILL.md's Key Rules table is a real, registered rule", () => {
    const tableSection =
      skillDoc.split("## Key Rules")[1]?.split("##")[0] ?? "";
    const mentionedIds = [
      ...tableSection.matchAll(/^\| ([a-z][a-z-]*)\s/gm),
    ].map((m) => m[1]!);
    expect(mentionedIds.length).toBeGreaterThanOrEqual(9);
    const unknownIds = mentionedIds.filter((id) => !realRuleIds.has(id));
    expect(unknownIds).toEqual([]);
  });

  it("guidance.ts's RULE_CATALOG covers exactly the same rule IDs as RULE_CONFIG_MAP", () => {
    const catalogIds = new Set(getRuleCatalog().map((r) => r.ruleId));
    expect(catalogIds).toEqual(realRuleIds);
  });
});

describe("docs drift: MCP audit tool option surface", () => {
  it("every option key documented in docs/guide/mcp.md's table exists in the tool's zod schema", () => {
    const tableSection =
      mcpDocs.split("The audit tool accepts:")[1]?.split("##")[0] ?? "";
    const documentedKeys = [
      ...tableSection.matchAll(/^\| `([a-zA-Z]+)`/gm),
    ].map((m) => m[1]!);
    expect(documentedKeys.length).toBeGreaterThanOrEqual(10);
    const schemaBlock =
      mcpServerSource
        .split("const auditOptionsSchema")[1]
        ?.split("// ─── Tool Registration")[0] ?? "";
    for (const key of documentedKeys) {
      expect(schemaBlock).toMatch(new RegExp(`\\b${key}:`));
    }
  });

  it("docs explicitly list capture/timeouts/interactions-policy as NOT exposed over MCP, matching the strict schema", () => {
    // Cross-checked at runtime in tests/integration/mcp-server.test.ts
    // ("rejects options outside the documented MCP surface"); this asserts the
    // docs and schema agree on what's excluded, statically.
    expect(mcpDocs).toMatch(/does not currently expose the complete/i);
    const schemaBlock =
      mcpServerSource
        .split("const auditOptionsSchema")[1]
        ?.split("// ─── Tool Registration")[0] ?? "";
    expect(schemaBlock).not.toMatch(/\bcapture:/);
    expect(schemaBlock).not.toMatch(/\btimeouts:/);
  });
});
