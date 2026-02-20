# AI Features

Keylens optionally integrates with LLMs to provide analysis that pure heuristics can't match. **The tool works fully without AI** — these are enhancement features.

## Setup

### Via Environment Variable

```bash
export KEYLENS_AI_API_KEY=sk-ant-api03-...
keylens audit https://example.com --ai
```

You can also use `ANTHROPIC_API_KEY` if you already have it set.

### Via Config File

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
      "accessibleNameInference": false,
      "crossPagePatterns": true
    }
  }
}
```

## Features

### Fix Suggestions

When a violation is detected, the AI inspects the actual HTML/CSS of the failing element and generates a structured fix suggestion including:

- **Summary** — brief description of the fix
- **Code before/after** — original and corrected code snippets (when applicable)
- **WCAG reference** — the specific success criteria addressed
- **Effort estimate** — low, medium, or high
- **Explanation** — why this fix works

Falls back to plain-text suggestions when structured output can't be generated. When `--screenshots` is enabled, computed focus styles (outline, box-shadow, border) are included for richer context.

### Focus Order Validation

Evaluates whether the tab order makes semantic sense given the page layout. This catches issues that simple geometric comparison (left-to-right, top-to-bottom) misses, like a sidebar nav that logically should come first despite being on the right side.

**Vision-based analysis:** When a page screenshot is available, Keylens annotates it with numbered markers at each focus position and sends it to the vision model. The AI analyzes the visual layout alongside the focus sequence metadata to produce a structured result:

- **Summary** — overall assessment of focus order quality
- **Issues** — specific problems with element index, severity, description, and suggested fix
- **Overall assessment** — `good`, `acceptable`, or `poor`

Falls back to text-only analysis when no screenshot is available.

### Report Summaries

Generates a structured executive summary of the audit results. When the AI can produce valid JSON, the summary includes:

- **Overview** — 2-3 sentence assessment for non-technical stakeholders
- **Critical issues** — the most important problems found
- **Prioritized fixes** — ordered list with effort (low/medium/high) and impact (high/medium/low) estimates
- **Overall score** — 1-100 accessibility score (90+ excellent, 70-89 good, 50-69 needs work, below 50 critical)
- **Recommendation** — one-sentence next step

Falls back to plain text when structured output can't be generated. For multi-page audits, `generateMultiPageSummary()` produces a site-wide assessment that incorporates cross-page patterns.

### Widget Classification

Classifies complex interactive elements by their WAI-ARIA Authoring Practices Guide (APG) pattern. The AI analyzes elements with complex ARIA roles (filtering out generic buttons, links, and text inputs) and identifies which pattern they follow.

**Supported patterns:** `dialog`, `menu`, `accordion`, `tabs`, `combobox`, `disclosure`, `tooltip`, `unknown`

For each classified widget, Keylens reports the identified pattern, a confidence score (0–1), and expected keyboard interactions.

```text
Widget: [role="tablist"] — "Main tabs"
  Pattern: tabs (confidence: 92%)
  Expected Keyboard:
    Arrow Right → Move to next tab
    Arrow Left  → Move to previous tab
    Home        → Move to first tab
    End         → Move to last tab
```

Only classifications with confidence >= 0.5 are included. Results appear in both CLI and HTML reports. Up to 20 elements are sent per audit to manage token usage.

### Accessible Name Inference

When enabled (`accessibleNameInference: true`), the AI examines interactive elements with empty or generic accessible names and suggests appropriate labels. This is particularly useful for icon buttons, image links, and custom widgets that lack `aria-label` attributes.

For each element, the AI provides:

- **Suggested label** — a descriptive `aria-label` value
- **Suggested role** — a corrected role (only if the current role is incorrect)
- **Confidence score** — 0 to 1
- **Reasoning** — explanation of why this label is appropriate

When a page screenshot is available, the AI uses vision analysis to examine the element in its visual context (e.g., recognizing an "X" icon as a close button). Up to 10 elements are analyzed per audit.

### Focus Indicator Quality Scoring

When enabled (`focusIndicatorQuality: true` and `--screenshots`), the AI evaluates the quality of existing focus indicators beyond simple exists/doesn't-exist detection. For each element with a confirmed focus indicator and both screenshots, the AI scores it on a 1-10 scale:

- **Score 9-10** — High contrast, clearly visible (thick outline, prominent glow, color change)
- **Score 7-8** — Adequate, meets WCAG 2.4.7
- **Score 5-6** — Visible but subtle (thin outline, low contrast)
- **Score 3-4** — Barely noticeable
- **Score 1-2** — Nearly invisible

Each score includes contrast assessment (`sufficient`, `low`, `very-low`), visibility assessment (`clear`, `subtle`, `nearly-invisible`), and an improvement recommendation when the score is 7 or below. Limited to 10 elements per audit.

### Cross-Page Pattern Detection

For multi-page audits (`auditMultiple()`), the AI detects inconsistent keyboard navigation patterns across pages. The detection uses a two-phase approach:

1. **Heuristic pre-filter** — local analysis (no AI call) identifies shared CSS selectors at different tab positions and skip link inconsistencies across pages
2. **AI enrichment** — when heuristics find issues, sends them to AI for classification, severity assessment, and fix suggestions

Detected pattern types:

- `inconsistent-order` — same component appears at different tab positions on different pages
- `missing-component` — interactive element present on some pages but missing from others
- `inconsistent-focus-style` — different focus indicator styles for the same component across pages
- `inconsistent-skip-link` — skip link present and functional on some pages but missing or broken on others

Falls back to heuristic-only patterns with generic descriptions if the AI call fails. Requires at least 2 pages. Controlled by `crossPagePatterns: true` (default).

## Privacy

When AI is enabled, the following data is sent to the AI provider:

- HTML snippets of failing elements (for fix suggestions)
- Focus sequence metadata (selectors, roles, positions)
- Page screenshots (for vision-based analysis)
- Interactive element details — tag names, roles, accessible names, outerHTML (for widget classification)

No data is sent when AI is disabled (the default).
