# Contributing to Keylens

First off, thank you for considering contributing to Keylens! Accessibility tooling benefits everyone, and your help makes the web a more inclusive place.

## Getting Started

### Prerequisites

- Node.js >= 22
- npm >= 10

### Setup

```bash
# Clone the repo
git clone https://github.com/telerik/keylens.git
cd keylens

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Run in development mode
npm run keylens -- audit https://example.com
```

### Project Structure

```
src/
├── cli/          # CLI entry point (Commander.js)
├── crawler/      # Playwright-based tab crawler
├── rules/        # Individual audit rules
├── reporters/    # Output formatters (CLI, JSON, HTML, Markdown)
├── ai/           # AI integration (Anthropic)
├── utils/        # Shared utilities
├── types/        # TypeScript type definitions
└── index.ts      # Main audit engine & public API
```

## Development Workflow

### Commands

```bash
npm run dev          # Build in watch mode
npm run build        # Production build
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Check for lint errors
npm run lint:fix     # Auto-fix lint errors
npm run typecheck    # Run TypeScript type checking
npm run format       # Format code with Prettier
```

### Running Keylens Locally

```bash
# Run from source with tsx
npm run keylens -- audit https://example.com --verbose

# Or build and run the compiled output
npm run build
node dist/cli/index.js audit https://example.com
```

## Contributing a New Rule

Rules are the core of Keylens. Adding a new rule is one of the best ways to contribute.

### 1. Create the rule file

Create `src/rules/my-new-rule.ts`:

```typescript
import type { Rule, CrawlResult, RuleResult } from "../types/index.js";

export class MyNewRule implements Rule {
  id = "my-new-rule";
  name = "My New Rule";
  description = "Detects ...";
  severity = "warning" as const;
  wcag = ["2.x.x"]; // Relevant WCAG success criteria

  async evaluate(crawlResult: CrawlResult): Promise<RuleResult> {
    const violations: RuleResult["violations"] = [];

    // Your detection logic here

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      violations,
      duration: 0,
    };
  }
}
```

### 2. Register the rule

Add it to `src/rules/index.ts`:

```typescript
import { MyNewRule } from "./my-new-rule.js";

const ALL_RULES: Rule[] = [
  // ... existing rules
  new MyNewRule(),
];
```

### 3. Add a config toggle

Add the config key to `KeylensConfig["rules"]` in `src/types/index.ts` and update the defaults in `src/utils/config.ts`.

### 4. Write tests

Create `tests/unit/rules/my-new-rule.test.ts` with test cases covering pass and fail scenarios.

## Pull Request Guidelines

1. **Branch from `main`** — use descriptive branch names like `feat/roving-tabindex-rule` or `fix/crawl-timeout`.
2. **Write tests** — every new rule and feature should have tests.
3. **Run the full check** before opening a PR:
   ```bash
   npm run lint && npm run typecheck && npm test
   ```
4. **Keep PRs focused** — one feature or fix per PR.
5. **Update docs** if your change affects the public API or CLI.

## Code Style

- We use **Prettier** for formatting and **ESLint** for linting.
- Husky + lint-staged run these on commit automatically.
- Use clear, descriptive names. Accessibility tooling should be approachable.
- Add JSDoc comments to public functions.

## Reporting Bugs

Use the [Bug Report template](https://github.com/telerik/keylens/issues/new?template=bug_report.yml). Include:

- Keylens version
- Node.js version
- The URL you were auditing (if possible)
- Terminal output with `--verbose` flag

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
