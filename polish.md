# Polish Keylens for Public Release


## Context
Keylens is feature-complete (Stages 0-7) and about to go public under `telerik/keylens`. This plan covers a pre-publication audit: fixing stale references, aligning documentation with actual implementation, filling test gaps, and cleaning up rough edges so the first impression is polished.


---


## 1. Fix Stale References & Config Drift


These are factual mismatches between code and documentation/config files.


### 1a. Stale `keylens/keylens` org URLs (2 files)
- `src/cli/index.ts:173` — `keylens init` emits `$schema` URL pointing to `keylens/keylens` → change to `telerik/keylens`
- `examples/keylens.config.json:2` — same stale `$schema` URL


### 1b. Stale rule name `focusLoss` (3 files)
The actual config key is `focusAfterInteraction` (see `src/utils/config.ts:20`), but several files still use the old name `focusLoss`:
- `README.md:135` — config example says `"focusLoss": true`
- `examples/keylens.config.json:12` — `"focusLoss": true`
- `keylens.config.schema.json:45` — defines `focusLoss` instead of `focusAfterInteraction`


### 1c. Config schema is incomplete (`keylens.config.schema.json`)
Missing vs actual `DEFAULT_CONFIG` in `src/utils/config.ts`:
- Missing rule: `focusNotObscured`
- Missing top-level props: `captureElementScreenshots`, `interactions`, `headed` (headed exists but others don't)
- Missing AI features: `accessibleNameInference`, `crossPagePatterns`


### 1d. README config example missing rules
`README.md:128-135` — config example shows 6 rules, missing `focusNotObscured` and `focusAfterInteraction`


### 1e. README rules table incomplete
`README.md:162-169` — table lists 6 rules, missing:
- `focus-not-obscured` (WCAG 2.4.11) — Error severity
- `focus-after-interaction` (WCAG 2.4.3/2.4.7) — Warning severity


### 1f. CONTRIBUTING.md mentions OpenAI
`CONTRIBUTING.md:38` — says `ai/` is "AI integration (Anthropic/OpenAI)" but only Anthropic is implemented


---


## 2. Version & Metadata Alignment


### 2a. Skill version mismatch
`skill/SKILL.md:13` — says `version: "0.2.0"` but `package.json:3` says `"0.1.0"`. Change skill to `0.1.0`.


### 2b. Empty `author` field
`package.json:29` — `"author": ""` → set to `"Progress Software Corporation"`


### 2c. CHANGELOG [Unreleased] section
`CHANGELOG.md:8-23` — MCP, skill, and sampling features are in `[Unreleased]` but ship with initial release. Merge into `[0.1.0]`.


### 2d. LICENSE copyright holder
`LICENSE:3` — says "Keylens Contributors" → change to "Progress Software Corporation"


---


## 3. README & Documentation Polish


### 3a. README CI example uses unscoped name
The GitHub Actions CI/CD example in README uses `npx keylens audit` — should be `npx @telerik/keylens audit` since it's a scoped package.


### 3b. README AI features section incomplete
Only lists Fix Suggestions, Focus Order Validation, Report Summaries, and Widget Classification. Missing from the "What AI adds" section:
- Accessible Name Inference
- Focus Indicator Quality Scoring
- Cross-Page Pattern Detection


### 3c. Config example missing AI features
Both README and example config show only 5 AI features. Missing `accessibleNameInference` and `crossPagePatterns`.


---


## 4. Test Coverage Gaps


### 4a. Multi-page reporter tests (HIGH value, LOW effort)
`reportMultiCLI()` and `reportMultiJSON()` have zero tests. These are pure functions that can be tested with factory data — straightforward to add.


**Files to create/modify:**
- `tests/unit/reporters/cli-reporter.test.ts` — add `describe("reportMultiCLI")`
- `tests/unit/reporters/json-reporter.test.ts` — add `describe("reportMultiJSON")`
- Use `makeMultiPageReport()` from `tests/helpers/factories.ts`


### 4b. Structured AI output rendering in reporters (MEDIUM value, MEDIUM effort)
Reporter tests only cover string-based AI outputs. The structured types (`FixSuggestion`, `AIReportSummary`, `AIFocusOrderResult`, widget classifications, accessible names, focus indicator scores) have rendering code in reporters but zero test coverage.


**Files to modify:**
- `tests/unit/reporters/cli-reporter.test.ts`
- `tests/unit/reporters/html-reporter.test.ts`


### 4c. SamplingTransport unit tests (MEDIUM value, LOW effort)
`src/mcp/sampling.ts` — `query()` and `queryVision()` methods are completely untested. Only `injectSampling()` is tested.


**File to create:** `tests/unit/mcp/sampling.test.ts`


### 4d. Unused test fixtures
- `tests/fixtures/focus-lost.html` — created for interaction testing but never used
- `tests/fixtures/skip-link-broken.html` — created for skip link testing but never used


Either wire these into integration tests or remove them.


### 4e. AI happy-path response parsing (MEDIUM value, HIGH effort)
No test exercises actual AI response parsing (structured JSON → typed objects, fallback to string on invalid JSON). All AI tests only exercise early-return paths. Could mock the transport to return realistic responses.


### 4f. CLI module untested (LOW priority for now)
`src/cli/index.ts` — viewport parsing, config merging, exit codes. Hard to unit test (process.exit, ora). The vitest config explicitly excludes it from coverage. Acceptable for v0.1.0 but worth noting.


---


## 5. Package & Build Polish


### ~~5a. MCP deps~~ — DECIDED: keep as `dependencies` (acceptable overhead)


### 5b. Config schema not shipped in npm package
`keylens.config.schema.json` is not in the `files` array in package.json. The `$schema` URL points to GitHub raw content, so it works if the file is in the repo — but shipping it in the package is better practice.


### 5c. `.gitignore` gaps
Missing: `*.tsbuildinfo`, `*.tgz` (npm pack output)


---


## 6. Low-Priority Polish (nice-to-have)


- ESLint: `no-explicit-any` is `warn` not `error`; consider `@typescript-eslint/no-floating-promises`
- `sideEffects: false` in package.json for tree-shaking consumers
- VitePress `base: "/keylens/"` — verify matches deployment target


---


## Implementation Order


### Phase A — Fix stale references & metadata (all doc/config edits)


| #  | Task                                                       | Files                                                      |
| -- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| 1  | Fix stale `keylens/keylens` URLs                           | `src/cli/index.ts`, `examples/keylens.config.json`         |
| 2  | Fix `focusLoss` → `focusAfterInteraction` everywhere       | `README.md`, `examples/keylens.config.json`, `keylens.config.schema.json` |
| 3  | Update config schema to match `DEFAULT_CONFIG`             | `keylens.config.schema.json`                               |
| 4  | Complete README: rules table, config example, AI features, CI example | `README.md`                                       |
| 5  | Sync config in examples with all AI features               | `examples/keylens.config.json`                             |
| 6  | Fix `author` + `files` in package.json                     | `package.json`                                             |
| 7  | Fix skill version 0.2.0 → 0.1.0                           | `skill/SKILL.md`                                           |
| 8  | Merge CHANGELOG [Unreleased] into [0.1.0]                  | `CHANGELOG.md`                                             |
| 9  | Fix CONTRIBUTING.md "Anthropic/OpenAI" → "Anthropic"       | `CONTRIBUTING.md`                                          |
| 10 | Fix LICENSE copyright → "Progress Software Corporation"    | `LICENSE`                                                  |
| 11 | Fix .gitignore gaps (`*.tsbuildinfo`, `*.tgz`)             | `.gitignore`                                               |


### Phase B — Add tests


| #  | Task                                                       | Files                                                      |
| -- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| 12 | Add `reportMultiCLI()` tests                               | `tests/unit/reporters/cli-reporter.test.ts`                |
| 13 | Add `reportMultiJSON()` tests                              | `tests/unit/reporters/json-reporter.test.ts`               |
| 14 | Add structured AI output rendering tests (CLI + HTML)      | `tests/unit/reporters/cli-reporter.test.ts`, `html-reporter.test.ts` |
| 15 | Add SamplingTransport unit tests                           | `tests/unit/mcp/sampling.test.ts` (new)                    |
| 16 | Wire unused fixtures into integration tests or remove them | `tests/fixtures/focus-lost.html`, `skip-link-broken.html`  |


## Verification


```bash
npm run lint && npm run typecheck && npm test && npm run build
grep -r "keylens/keylens\|focusLoss" src/ examples/ README.md keylens.config.schema.json
npm pack --dry-run  # verify package contents
```



