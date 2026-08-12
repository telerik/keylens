/**
 * Core types for Keylens keyboard navigation testing.
 */

// ─── Configuration ───────────────────────────────────────────────

export interface KeylensConfig {
  /** Execution accuracy/speed preset applied before explicit overrides */
  profile: ExecutionProfile;

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

  /** Bounded post-activation focus testing */
  interactions: InteractionConfig;

  /** Multi-page browser reuse and concurrency policy */
  multiPage: MultiPageConfig;

  /** Bounded screenshot capture policy */
  capture: CaptureConfig;

  /** Planned GA wall-time budgets. Phase-specific enforcement is introduced separately. */
  timeouts: PhaseTimeoutConfig;

  /** Overlay/consent-banner dismissal run before capture and crawl */
  prepare: PrepareConfig;
}

export type ExecutionProfile = "fast" | "balanced" | "thorough";
export type PageCaptureMode = "none" | "viewport" | "full";

export interface CaptureLimits {
  /** Maximum number of focused elements with screenshot pairs */
  maxElements?: number;
  /** Maximum width or height of a captured image */
  maxDimension?: number;
  /** Maximum decoded pixels across captured assets */
  maxPixels?: number;
  /** Maximum encoded bytes across captured assets */
  maxBytes?: number;
}

export interface CaptureConfig {
  /** Page-level screenshot behavior */
  page: PageCaptureMode;
  /** Capture focused and unfocused element screenshots */
  elements: boolean;
  /** Resource bounds for captured assets */
  limits: CaptureLimits;
}

export interface CaptureSummary {
  attempted: number;
  captured: number;
  skipped: number;
  failed: number;
  byteLength: number;
  decodedPixels: number;
}

export type InteractionAction = "click" | "enter" | "space";
export type InteractionIsolation = "reload" | "none";
export type InteractionNavigationPolicy = "block" | "allow";

export interface InteractionConfig {
  /** Enable post-activation focus testing */
  enabled: boolean;
  /** Maximum attempted element/action cases */
  maxCases: number;
  /** Timeout for each focus or activation operation */
  timeout: number;
  /** Optional CSS selectors limiting eligible controls */
  include?: string[];
  /** CSS selectors excluded with an explicit skipped outcome */
  exclude?: string[];
  /** Activation methods to test for each eligible control */
  actions: InteractionAction[];
  /** Reset page state before each attempted case */
  isolation: InteractionIsolation;
  /** Whether top-level navigation may proceed */
  navigation: InteractionNavigationPolicy;
  /** Skip controls whose accessible name indicates a destructive action */
  excludeDestructive: boolean;
}

export interface MultiPageConfig {
  /** Maximum isolated browser contexts audited concurrently */
  concurrency: number;
}

// ─── Prepare Phase (overlay/consent-banner dismissal) ────────────

/** Which consent action to prefer when a banner offers multiple choices. */
export type PrepareConsentPreference = "reject" | "accept" | "close";

/** A cookie set on the browser context before navigation. */
export interface PrepareCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export type PrepareStep =
  | { type: "click"; selector: string; optional?: boolean }
  | { type: "press"; key: string }
  | { type: "wait"; ms: number }
  | { type: "waitFor"; selector: string; timeout?: number };

export interface PrepareConfig {
  /** Auto-detect and dismiss known consent/cookie banners before the crawl (default: true) */
  dismissOverlays: boolean;
  /** Which button to click when a banner offers multiple choices (default: "reject") */
  consentPreference: PrepareConsentPreference;
  /** Extra CSS selectors to click, for banners not covered by built-in presets */
  dismissSelectors?: string[];
  /** Whole-phase wall-time budget in ms (default: 5000) */
  timeout: number;
  /** Cookies applied to the browser context before navigation */
  cookies?: PrepareCookie[];
  /** Generic scripted steps run after overlay dismissal (click/press/wait/waitFor) */
  steps?: PrepareStep[];
  /**
   * Detect and neutralize full-page "faux scroll" containers — `overflow: auto/scroll`
   * wrappers that intercept scrolling instead of the document itself, common in
   * parallax/smooth-scroll page designs. When detected, the container is expanded
   * (overflow/height reset) so `document.scrollHeight`, full-page screenshots, and the
   * HTML focus-map overlay reflect the true page length (default: true).
   */
  expandScrollContainers: boolean;
}

/** A single overlay/banner dismissal attempt and its outcome. */
export interface OverlayDismissal {
  /** Preset provider name, "heuristic", or "custom" (dismissSelectors) */
  provider: string;
  /** Which action was taken */
  action: PrepareConsentPreference | "custom";
  /** Selector that was clicked */
  selector: string;
  /** Whether the container was confirmed hidden/detached afterwards */
  verified: boolean;
}

/** A faux full-page scroll container that was detected and neutralized. */
export interface ScrollContainerExpansion {
  /** Best-effort CSS selector identifying the expanded container */
  selector: string;
  /** The container's `scrollHeight` before expansion */
  originalHeight: number;
  /** `document.documentElement.scrollHeight` after expansion */
  expandedHeight: number;
}

export interface PrepareResult {
  /** Whether the prepare phase ran at all (false when dismissOverlays is disabled and no steps configured) */
  attempted: boolean;
  /** Overlay dismissals performed, in order */
  dismissals: OverlayDismissal[];
  /** Non-fatal issues encountered during prepare (never fail the audit) */
  warnings: string[];
  /** Time taken for the prepare phase in ms */
  duration: number;
  /** Details of a faux-scroll container that was detected and expanded, if any */
  scrollContainerExpanded?: ScrollContainerExpansion;
}

export interface PhaseTimeoutConfig {
  /** Entire audit wall-time budget */
  total?: number;
  /** Crawl phase wall-time budget */
  crawl?: number;
  /** Deterministic rule evaluation wall-time budget */
  rules?: number;
  /** Interaction phase wall-time budget */
  interactions?: number;
  /** Experimental AI enrichment wall-time budget */
  ai?: number;
  /** Reporter/rendering wall-time budget */
  reporters?: number;
}

export type AIConfigInput = Partial<Omit<AIConfig, "features" | "limits">> & {
  features?: Partial<AIConfig["features"]>;
  limits?: Partial<NonNullable<AIConfig["limits"]>>;
};

export interface KeylensConfigInput extends Omit<
  Partial<KeylensConfig>,
  | "viewport"
  | "rules"
  | "ai"
  | "capture"
  | "interactions"
  | "multiPage"
  | "timeouts"
  | "prepare"
> {
  viewport?: Partial<KeylensConfig["viewport"]>;
  rules?: Partial<RuleConfig>;
  ai?: AIConfigInput;
  capture?: Partial<Omit<CaptureConfig, "limits">> & {
    limits?: Partial<CaptureLimits>;
  };
  interactions?: Partial<InteractionConfig>;
  multiPage?: Partial<MultiPageConfig>;
  timeouts?: Partial<PhaseTimeoutConfig>;
  prepare?: Partial<PrepareConfig>;
}

export interface AuditOptions extends KeylensConfigInput {
  /** Cancels the audit and all owned resources */
  signal?: AbortSignal;
  /** Receives structured lifecycle and progress events */
  onEvent?: (event: AuditEvent) => void;
  /** Controls internal diagnostic output; programmatic APIs default to silent */
  logLevel?: LogLevel;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface AIEnrichmentOptions {
  ai?: AIConfigInput;
  signal?: AbortSignal;
  onEvent?: (event: AuditEvent) => void;
  logLevel?: LogLevel;
}

export interface RenderOptions {
  signal?: AbortSignal;
  timeout?: number;
  logLevel?: LogLevel;
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

export interface WcagReference {
  id: string;
  title: string;
  url: string;
}

export interface RuleRemediation {
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  guidance: string;
  codeExample?: string;
  wcag: readonly WcagReference[];
}

/** Provider-agnostic transport for AI queries (e.g. MCP sampling). */
export interface AITransport {
  query(prompt: string, signal?: AbortSignal): Promise<string>;
  queryVision(
    prompt: string,
    images: Array<{ base64: string; mediaType: string }>,
    signal?: AbortSignal,
  ): Promise<string>;
}

export interface AIConfig {
  /** Enable AI-powered analysis */
  enabled: boolean;
  /** AI provider */
  provider: "anthropic" | "openai";
  /** API key (or use env var KEYLENS_AI_API_KEY) */
  apiKey?: string;
  /** AI model to use */
  model?: string;
  /** Base URL for AI provider (Azure AI Foundry, custom OpenAI-compatible endpoints) */
  baseURL?: string;
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

// ─── Execution Contracts ─────────────────────────────────────────

export const AUDIT_REPORT_SCHEMA_VERSION = "1.0" as const;
export type AuditReportSchemaVersion = typeof AUDIT_REPORT_SCHEMA_VERSION;

export type AuditPhase =
  | "setup"
  | "navigation"
  | "prepare"
  | "capture"
  | "crawl"
  | "rules"
  | "interactions"
  | "ai"
  | "reporters"
  | "cleanup";

interface AuditEventBase {
  timestamp: string;
  elapsedMs: number;
  phase: AuditPhase;
  url?: string;
}

export type AuditEvent =
  | (AuditEventBase & {
      type: "phase-started" | "phase-completed";
    })
  | (AuditEventBase & {
      type: "crawl-progress";
      tabsAttempted: number;
      maxTabs: number;
      elementsFocused: number;
    })
  | (AuditEventBase & {
      type: "rule-started" | "rule-completed";
      ruleId: string;
    })
  | (AuditEventBase & {
      type: "asset-captured";
      assetType: AuditAssetType;
      byteLength: number;
    })
  | (AuditEventBase & {
      type: "interaction-progress";
      attempted: number;
      completed: number;
      maxCases: number;
    })
  | (AuditEventBase & {
      type: "interaction-completed";
      attempted: number;
      completed: number;
    })
  | (AuditEventBase & {
      type: "overlay-dismissed";
      provider: string;
      action: PrepareConsentPreference | "custom";
      selector: string;
      verified: boolean;
    })
  | (AuditEventBase & {
      type: "warning";
      code: string;
      message: string;
    });

export type AuditAssetType =
  | "page-screenshot"
  | "focused-element-screenshot"
  | "unfocused-element-screenshot"
  | "html-report"
  | "json-report"
  | "markdown-report";

export type AuditAssetStorage =
  | { kind: "inline"; data: string; encoding: "base64" | "utf8" }
  | { kind: "file"; path: string }
  | { kind: "url"; url: string };

export interface AuditAsset {
  id: string;
  type: AuditAssetType;
  mediaType: string;
  byteLength: number;
  storage: AuditAssetStorage;
}

export type AssetProjectionMode = "omit" | "inline" | "references";

export interface AssetProjectionOptions {
  assets: AssetProjectionMode;
  /** Required for references mode to replace inline bytes with a file or URL. */
  reference?: (
    asset: AuditAsset,
    context: { url: string; pageIndex?: number },
  ) => Extract<AuditAssetStorage, { kind: "file" | "url" }>;
}

export interface EffectiveAIConfig extends Omit<
  AIConfig,
  "apiKey" | "transport"
> {
  apiKeyConfigured: boolean;
  transportConfigured: boolean;
}

export interface EffectiveKeylensConfig extends Omit<KeylensConfig, "ai"> {
  ai: EffectiveAIConfig;
}

export interface AuditTimings {
  crawl: number;
  rules: number;
  ai?: number;
  total: number;
}

export interface MultiPageAuditTimings {
  pages: number;
  ai?: number;
  total: number;
}

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

  /** Asset containing the focused element screenshot */
  focusedScreenshotAssetId?: string;

  /** Asset containing the unfocused element screenshot */
  unfocusedScreenshotAssetId?: string;

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

  /** Asset containing the page screenshot */
  pageScreenshotAssetId?: string;

  /** Captured screenshot assets */
  assets: AuditAsset[];

  /** Time taken for the crawl in ms */
  crawlDuration: number;

  /** Page dimensions (scrollable area) */
  pageDimensions?: { width: number; height: number };

  /** Skip link test result (if skip link was tested) */
  skipLinkResult?: SkipLinkResult;

  /** Results of post-click interaction testing (if --interactions enabled) */
  interactionResults?: InteractionResult[];

  /** Aggregate interaction case outcomes */
  interactionSummary?: InteractionSummary;

  /** Overlay/consent-banner dismissal result (always present, even if no-op) */
  prepare?: PrepareResult;

  /** Capture resource usage and skipped/failed attempts */
  capture: CaptureSummary;
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
  action: InteractionAction;

  /** Where focus moved after the interaction (null = focus lost) */
  focusAfter: {
    selector: string;
    tagName: string;
    role: string;
  } | null;

  /** Explicit outcome for attempted and skipped cases */
  status: "passed" | "failed" | "skipped" | "error";

  /** Stable machine-readable outcome reason */
  reason:
    | "focus-preserved"
    | "focus-moved"
    | "focus-lost"
    | "unexpected-focus"
    | "excluded"
    | "destructive"
    | "limit-reached"
    | "navigation-blocked"
    | "element-missing"
    | "action-failed";

  /** Human-readable outcome detail */
  message?: string;

  /** Wall time for this case */
  duration: number;
}

export interface InteractionSummary {
  total: number;
  attempted: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
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
    accessibleName?: string;
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

  /** Distinguishes accessibility failures from evaluator failures */
  status?: "passed" | "failed" | "error";

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

  /** Structured evaluator failure details when status is "error" */
  error?: {
    code: "RULE_ERROR";
    message: string;
  };
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
  /** Version of the serialized report contract */
  schemaVersion: AuditReportSchemaVersion;

  /** Tool version */
  version: string;

  /** Timestamp of the audit */
  timestamp: string;

  /** URL audited */
  url: string;

  /** Configuration used */
  config: EffectiveKeylensConfig;

  /** Wall-clock duration by execution phase */
  timings: AuditTimings;

  /** Crawl results */
  crawl: {
    totalFocusableElements: number;
    totalInteractiveElements: number;
    unreachedElements: number;
    cycleCompleted: boolean;
    duration: number;
    /** Interaction case outcomes when interaction testing is enabled */
    interactions?: InteractionSummary;
    /** Overlay/consent-banner dismissal result */
    prepare?: PrepareResult;
    /** Capture resource usage and skipped/failed attempts */
    capture: CaptureSummary;
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
    /** Rules that could not be evaluated */
    errors: number;
    /** Deterministic heuristic score 0–100 based on rule results */
    score: number;
    /** False when one or more rules could not be evaluated */
    scoreComplete: boolean;
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

  /** Asset containing the page screenshot */
  pageScreenshotAssetId?: string;

  /** Captured binary and rendered assets */
  assets: AuditAsset[];

  /** Focus sequence for visualization */
  focusSequence?: FocusedElement[];

  /** Interactive elements retained for optional staged enrichment */
  interactiveElements?: InteractiveElement[];

  /** Per-case post-activation outcomes */
  interactionResults?: InteractionResult[];

  /** Page dimensions for focus map overlay rendering */
  pageDimensions?: { width: number; height: number };
}

// ─── Multi-Page Report ───────────────────────────────────────────

export interface MultiPageReport {
  /** Version of the serialized report contract */
  schemaVersion: AuditReportSchemaVersion;

  /** Tool version */
  version: string;

  /** Timestamp of the audit */
  timestamp: string;

  /** URLs audited */
  urls: string[];

  /** Individual page reports */
  pages: AuditReport[];

  /** Wall-clock duration for page work and optional enrichment */
  timings: MultiPageAuditTimings;

  /** Aggregate summary across all pages */
  summary: {
    totalPages: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    ruleErrors: number;
    pagesWithErrors: number;
    /** Average deterministic score across all pages (0–100) */
    score: number;
    /** False when any page has an incomplete deterministic score */
    scoreComplete: boolean;
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
