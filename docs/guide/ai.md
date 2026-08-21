# Experimental AI

AI enrichment is optional, nondeterministic, and outside the stable core contract.
Deterministic crawling, rules, scores, and reports work without it. Do not use an AI
summary or severity rating as a release gate.

## Providers and credentials

Supported providers are Anthropic and OpenAI-compatible APIs, including Azure AI
Foundry endpoints.

```bash
export KEYLENS_AI_API_KEY="..."
npx keylens audit https://example.com --ai
```

Resolution order is `ai.apiKey`, `KEYLENS_AI_API_KEY`, then the provider-specific
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. Avoid putting secrets in config files.

```json
{
  "ai": {
    "enabled": true,
    "provider": "openai",
    "baseURL": "https://example.openai.azure.com/openai/deployments/keylens",
    "model": "gpt-4o"
  }
}
```

Default models are `claude-sonnet-4-20250514` for Anthropic and `gpt-4o` for OpenAI.
Provider availability, model capabilities, pricing, retention, and regional processing
are controlled by the provider.

## Features and defaults

| Feature                   | Default when AI is enabled | Input                                               |
| ------------------------- | -------------------------- | --------------------------------------------------- |
| Fix suggestions           | On                         | Violations and element HTML/style context           |
| Focus-order validation    | On                         | Focus sequence; annotated page image when available |
| Report summary            | On                         | Rule and report data                                |
| Widget classification     | Off                        | Interactive element metadata                        |
| Focus-indicator quality   | Off                        | Complete focused/unfocused image pairs              |
| Accessible-name inference | Off                        | Candidate metadata and page image when available    |

Features can return structured results or documented fallback text. AI failures throw
an operational error rather than silently changing deterministic rule results.

```json
{
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "features": {
      "focusOrderValidation": true,
      "fixSuggestions": true,
      "widgetClassification": false,
      "reportSummary": true,
      "focusIndicatorQuality": false,
      "accessibleNameInference": false
    },
    "limits": {
      "batchSize": 10,
      "maxWidgets": 20,
      "maxElements": 10
    }
  },
  "timeouts": { "ai": 30000 }
}
```

`batchSize` chunks fix suggestions, `maxWidgets` bounds widget candidates, and
`maxElements` bounds element-oriented AI features.

## Visual features

Focus-order validation and accessible-name inference use the page image only if page
capture produced an inline asset; otherwise they fall back to nonvisual data.
Focus-indicator quality additionally requires `capture.elements: true` and a complete
focused/unfocused pair. Capture limits can therefore reduce AI coverage.

```bash
npx keylens audit https://example.com --ai \
  --page-screenshot full --screenshots
```

The deterministic `missing-focus-indicator` rule does not require AI.

## Data and privacy

Depending on enabled features and available captures, Keylens can send:

- violation text and truncated element HTML;
- selectors, roles, accessible names, positions, and focus sequence metadata;
- interactive-element and landmark context;
- page screenshots or focused/unfocused element images;
- deterministic report summaries and cross-page heuristic candidates.

No data is sent when AI is disabled. Before enabling AI, review provider terms,
retention, training, location, access controls, and incident response. Avoid auditing
pages containing secrets, personal data, payment data, or regulated information unless
your provider agreement and organizational policy permit it.

## Nondeterminism and validation

Model versions and outputs can change, repeat calls can disagree, generated code can be
incorrect, and visual interpretation can miss or invent issues. Treat AI fields as
advisory. Reproduce findings with the deterministic report and manual keyboard testing
before changing production code.

## Programmatic custom transport

`AITransport` supplies `query()` and `queryVision()` methods and receives the audit
`AbortSignal`. A transport is used when configured and no direct API key is resolved.
This enables experimental adapters such as MCP sampling without changing the stable
deterministic pipeline.
