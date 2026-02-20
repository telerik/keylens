/**
 * Core types for Keylens keyboard navigation testing.
 */

// ─── Configuration ───────────────────────────────────────────────

export interface KeylensConfig {
  /** URL(s) to audit */
  urls: string[];

  /** Viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };

  /** Maximum number of tab presses before aborting */
  maxTabs: number;

  /** Timeout in ms for each tab press */
  tabTimeout: number;

  /** Wait for this selector before starting the audit */
  waitForSelector?: string;

  /** Wait this many ms after page load */
  waitAfterLoad: number;

  /** Delay in ms between tab presses to let focus settle */
  tabDelay: number;

  /** Which rules to run */
  rules: RuleConfig;

  /** Report output settings */
  reporters: ReporterType[];

  /** Output directory for reports */
  outputDir: string;

  /** Browser to use */
  browser: "chromium" | "firefox" | "webkit";

  /** AI configuration */
  ai: AIConfig;

  /** Navigation timeout in ms (default: 30000) */
  navigationTimeout: number;

  /** Run in headed mode (visible browser) */
  headed: boolean;

  /** Capture per-element focused/unfocused screenshots for focus indicator diffing */
  captureElementScreenshots: boolean;

  /** Enable post-click interaction testing (click buttons, verify focus isn't lost) */
  interactions: boolean;
}

export interface RuleConfig {
  /** Detect keyboard traps */
  keyboardTrap: boolean;
  /** Detect unreachable interactive elements */
  unreachableElements: boolean;
  /** Detect focus order vs visual order mismatches */
  focusOrderMismatch: boolean;
  /** Detect positive tabindex values */
  tabindexAbuse: boolean;
  /** Detect missing focus indicators */
  missingFocusIndicator: boolean;
  /** Validate skip link presence and functionality */
  skipLink: boolean;
  /** Detect focused elements obscured by sticky/fixed content (WCAG 2.4.11) */
  focusNotObscured: boolean;
  /** Detect focus lost after clicking interactive elements */
  focusAfterInteraction: boolean;
}

/** Provider-agnostic transport for AI queries (e.g. MCP sampling). */
export interface AITransport {
  query(prompt: string): Promise<string>;
  queryVision(
    prompt: string,
    images: Array<{ base64: string; mediaType: string }>,
  ): Promise<string>;
}

export interface AIConfig {
  /** Enable AI-powered analysis */
  enabled: boolean;
  /** AI provider */
  provider: "anthropic";
  /** API key (or use env var KEYLENS_AI_API_KEY) */
  apiKey?: string;
  /** AI model to use */
  model?: string;
  /** Custom AI transport (e.g. MCP sampling). Takes priority over direct API when no apiKey is set. */
  transport?: AITransport;
  /** Which AI features to enable */
  features: {
    focusOrderValidation: boolean;
    fixSuggestions: boolean;
    widgetClassification: boolean;
    reportSummary: boolean;
    focusIndicatorQuality: boolean;
    accessibleNameInference: boolean;
    crossPagePatterns: boolean;
  };
  /** Batch/element limits for AI features */
  limits?: {
    /** Fix suggestion chunk size (default: 10) */
    batchSize?: number;
    /** Max widgets for classification (default: 20) */
    maxWidgets?: number;
    /** Max elements per AI feature call — name inference, focus scoring, cross-page (default: 10) */
    maxElements?: number;
  };
}

export type ReporterType = "cli" | "json" | "html" | "markdown";

// ─── Crawl Results ───────────────────────────────────────────────

export interface FocusedElement {
  /** Position in the tab sequence (1-indexed) */
  tabIndex: number;

  /** CSS selector path */
  selector: string;

  /** HTML tag name */
  tagName: string;

  /** Computed accessible role */
  role: string;

  /** Computed accessible name */
  accessibleName: string;

  /** Element's bounding rectangle */
  boundingRect: BoundingRect;

  /** The tabindex attribute value (if set) */
  tabindexAttr: number | null;

  /** Whether the element has a visible focus indicator */
  hasFocusIndicator: boolean | null;

  /** Whether the element is obscured by other content when focused (WCAG 2.4.11) */
  isObscured?: boolean;

  /** Screenshot of the element in focused state (base64 PNG) */
  focusedScreenshot?: string;

  /** Screenshot of the element in unfocused state (base64 PNG) */
  unfocusedScreenshot?: string;

  /** Element's bounding rectangle in absolute page coordinates (accounts for scroll) */
  pageRect?: BoundingRect;

  /** Computed focus-related CSS styles (captured when --screenshots enabled) */
  computedFocusStyles?: {
    outline: string;
    boxShadow: string;
    border: string;
  };

  /** Raw outer HTML (truncated) */
  outerHTML: string;

  /** All aria-* attributes on this element */
  ariaAttributes?: Record<string, string>;

  /** Nearest semantic landmark ancestor (nav, main, form, dialog, etc.) */
  parentContext?: string;
}

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InteractiveElement {
  /** CSS selector path */
  selector: string;
  /** HTML tag name */
  tagName: string;
  /** Computed accessible role */
  role: string;
  /** Computed accessible name */
  accessibleName: string;
  /** Bounding rectangle */
  boundingRect: BoundingRect;
  /** Whether this element was reached during tabbing */
  reached: boolean;
  /** The tabindex attribute value (null if not set) */
  tabindexAttr: number | null;
  /** Raw outer HTML (truncated) */
  outerHTML: string;
}

export interface SkipLinkResult {
  /** Whether a skip link was found */
  found: boolean;

  /** The skip link element (if found) */
  element?: {
    selector: string;
    accessibleName: string;
    outerHTML: string;
  };

  /** Whether activating the skip link moved focus to main content */
  functionWorks: boolean;

  /** Where focus moved after activating the skip link */
  focusTarget?: string;
}

export interface CrawlResult {
  /** URL that was crawled */
  url: string;

  /** Ordered list of focused elements */
  focusSequence: FocusedElement[];

  /** All interactive elements found on the page */
  interactiveElements: InteractiveElement[];

  /** Whether the tab cycle completed (focus returned to start) */
  cycleCompleted: boolean;

  /** Full-page screenshot (base64 PNG) */
  pageScreenshot: string;

  /** Time taken for the crawl in ms */
  crawlDuration: number;

  /** Page dimensions (scrollable area) */
  pageDimensions?: { width: number; height: number };

  /** Skip link test result (if skip link was tested) */
  skipLinkResult?: SkipLinkResult;

  /** Results of post-click interaction testing (if --interactions enabled) */
  interactionResults?: InteractionResult[];
}

// ─── Interaction Results ─────────────────────────────────────────

export interface InteractionResult {
  /** The element that was interacted with */
  element: {
    selector: string;
    tagName: string;
    role: string;
    accessibleName: string;
  };

  /** The action performed */
  action: "click" | "enter" | "space";

  /** Where focus moved after the interaction (null = focus lost) */
  focusAfter: {
    selector: string;
    tagName: string;
    role: string;
  } | null;

  /** Whether the focus position after interaction is reasonable */
  focusReasonable: boolean;

  /** Description of the issue (if any) */
  issue?: string;
}

// ─── Widget Classification ──────────────────────────────────────

export type APGPattern =
  | "dialog"
  | "menu"
  | "accordion"
  | "tabs"
  | "combobox"
  | "disclosure"
  | "tooltip"
  | "unknown";

export interface WidgetClassification {
  /** The classified element */
  element: {
    selector: string;
    tagName: string;
    role: string;
    accessibleName: string;
    outerHTML: string;
  };

  /** The identified WAI-ARIA APG pattern */
  pattern: APGPattern;

  /** Confidence score (0-1) */
  confidence: number;

  /** Expected keyboard interactions for this pattern */
  expectedKeyboard: Array<{
    key: string;
    expectedBehavior: string;
  }>;
}

// ─── Rule Results ────────────────────────────────────────────────

export type Severity = "error" | "warning" | "info";

export interface RuleViolation {
  /** Rule identifier */
  ruleId: string;

  /** Human-readable rule name */
  ruleName: string;

  /** Severity level */
  severity: Severity;

  /** Description of the issue */
  message: string;

  /** Affected element(s) */
  elements: Array<{
    selector: string;
    outerHTML: string;
    tabPosition?: number;
  }>;

  /** WCAG success criteria reference */
  wcag?: string[];

  /** AI-generated fix suggestion (string for backward compat, or structured) */
  fixSuggestion?: string | FixSuggestion;

  /** Impact description */
  impact: string;
}

export interface RuleResult {
  /** Rule identifier */
  ruleId: string;

  /** Whether the rule passed */
  passed: boolean;

  /** Violations found */
  violations: RuleViolation[];

  /** Time taken to run the rule in ms */
  duration: number;

  /** Human-readable rule name (copied from Rule) */
  ruleName?: string;

  /** Rule description (copied from Rule) */
  ruleDescription?: string;

  /** WCAG criteria this rule checks (copied from Rule) */
  wcag?: string[];
}

// ─── Rule Interface ──────────────────────────────────────────────

export interface Rule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Rule description */
  description: string;

  /** Default severity */
  severity: Severity;

  /** WCAG criteria this rule checks */
  wcag: string[];

  /** Run the rule against crawl results */
  evaluate(crawlResult: CrawlResult): Promise<RuleResult>;
}

// ─── Audit Report ────────────────────────────────────────────────

export interface AuditReport {
  /** Tool version */
  version: string;

  /** Timestamp of the audit */
  timestamp: string;

  /** URL audited */
  url: string;

  /** Configuration used */
  config: Partial<KeylensConfig>;

  /** Crawl results */
  crawl: {
    totalFocusableElements: number;
    totalInteractiveElements: number;
    unreachedElements: number;
    cycleCompleted: boolean;
    duration: number;
  };

  /** Rule results */
  rules: RuleResult[];

  /** Summary statistics */
  summary: {
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    passed: number;
    failed: number;
    /** Deterministic heuristic score 0–100 based on rule results */
    score: number;
  };

  /** AI-generated summary (if enabled) — string for backward compat, or structured */
  aiSummary?: string | AIReportSummary;

  /** AI focus order analysis (if enabled) — string for text-only, structured for vision */
  aiFocusOrderAnalysis?: string | AIFocusOrderResult;

  /** AI widget classifications (if enabled) */
  widgetClassifications?: WidgetClassification[];

  /** AI accessible name suggestions (if enabled) */
  accessibleNameSuggestions?: AccessibleNameSuggestion[];

  /** AI focus indicator quality scores (if enabled and --screenshots used) */
  focusIndicatorScores?: FocusIndicatorScore[];

  /** Full-page screenshot (base64) */
  pageScreenshot?: string;

  /** Focus sequence for visualization */
  focusSequence?: FocusedElement[];

  /** Page dimensions for focus map overlay rendering */
  pageDimensions?: { width: number; height: number };
}

// ─── Multi-Page Report ───────────────────────────────────────────

export interface MultiPageReport {
  /** Tool version */
  version: string;

  /** Timestamp of the audit */
  timestamp: string;

  /** URLs audited */
  urls: string[];

  /** Individual page reports */
  pages: AuditReport[];

  /** Aggregate summary across all pages */
  summary: {
    totalPages: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    pagesWithErrors: number;
    /** Average deterministic score across all pages (0–100) */
    score: number;
  };

  /** AI-generated cross-page summary (if enabled) — string or structured */
  aiSummary?: string | AIReportSummary;

  /** AI-detected cross-page patterns (if multi-page audit with AI) */
  crossPagePatterns?: CrossPagePattern[];
}

// ─── AI Types ────────────────────────────────────────────────────

// ─── Structured AI Results (Stage 5) ─────────────────────────────

export interface FocusOrderIssue {
  /** Index in the focus sequence (1-based) */
  elementIndex: number;
  /** Description of the issue */
  description: string;
  /** Severity of this specific issue */
  severity: "error" | "warning" | "info";
  /** Suggested fix */
  suggestion: string;
}

export interface AIFocusOrderResult {
  /** Overall summary of focus order quality */
  summary: string;
  /** Specific issues found */
  issues: FocusOrderIssue[];
  /** Overall assessment: good, acceptable, or poor */
  overallAssessment: "good" | "acceptable" | "poor";
}

export interface FixSuggestion {
  /** Brief summary of the fix */
  summary: string;
  /** Original code (if applicable) */
  codeBefore?: string;
  /** Suggested replacement code */
  codeAfter?: string;
  /** WCAG success criteria reference */
  wcagRef: string;
  /** Estimated effort: low, medium, or high */
  estimatedEffort: "low" | "medium" | "high";
  /** Detailed explanation of why this fix works */
  explanation: string;
}

export interface AccessibleNameSuggestion {
  /** The element being analyzed */
  element: {
    selector: string;
    tagName: string;
    role: string;
    outerHTML: string;
  };
  /** Suggested accessible label */
  suggestedLabel: string;
  /** Suggested role (if current role is incorrect) */
  suggestedRole?: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for the suggestion */
  reasoning: string;
}

// ─── Structured AI Results (Stage 6) ─────────────────────────────

export interface FocusIndicatorScore {
  /** The scored element */
  element: {
    selector: string;
    tagName: string;
    role: string;
    accessibleName: string;
  };
  /** Quality score from 1 (worst) to 10 (best) */
  score: number;
  /** Contrast assessment */
  contrast: "sufficient" | "low" | "very-low";
  /** Visibility assessment */
  visibility: "clear" | "subtle" | "nearly-invisible";
  /** AI recommendation for improvement (only when score <= 7) */
  recommendation?: string;
}

export interface AIReportSummary {
  /** Brief overall assessment (2-3 sentences) */
  overview: string;
  /** Most critical issues found */
  criticalIssues: string[];
  /** Prioritized fixes with effort estimates */
  prioritizedFixes: Array<{
    fix: string;
    effort: "low" | "medium" | "high";
    impact: "high" | "medium" | "low";
  }>;
  /** AI-generated usability severity rating 1-100 (non-deterministic; see summary.score for the stable rule-based score) */
  aiSeverityRating: number;
  /** One-sentence recommendation for next steps */
  recommendation: string;
}

export type CrossPagePatternType =
  | "inconsistent-order"
  | "missing-component"
  | "inconsistent-focus-style"
  | "inconsistent-skip-link";

export interface CrossPagePattern {
  /** The type of cross-page inconsistency */
  type: CrossPagePatternType;
  /** Human-readable description of the pattern */
  description: string;
  /** URLs of affected pages */
  affectedPages: string[];
  /** Severity of this inconsistency */
  severity: Severity;
  /** AI-generated suggestion for fixing */
  suggestion: string;
}
