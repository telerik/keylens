/**
 * Core types for Keylens keyboard navigation testing.
 */

// ─── Configuration ───────────────────────────────────────────────

export interface KeylensConfig {
  /** Execution accuracy/speed preset applied before explicit overrides */
  profile: ExecutionProfile;

  /** URL to audit (used only as a config-file fallback; audit()/auditBase() take the URL as an explicit argument) */
  url?: string;

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

  /** Base file name (without extension) for report files. Defaults to "keylens-report" */
  outputFileName?: string;

  /** Append a "-YYYY-MM-DDTHH-mm-ss" timestamp to report file names so repeated runs don't overwrite each other */
  appendTimestamp: boolean;

  /** Browser to use */
  browser: "chromium" | "firefox" | "webkit";

  /** Navigation timeout in ms (default: 30000) */
  navigationTimeout: number;

  /** Run in headed mode (visible browser) */
  headed: boolean;

  /** Bounded post-activation focus testing */
  interactions: InteractionConfig;

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
  /** Reporter/rendering wall-time budget */
  reporters?: number;
}

export interface KeylensConfigInput extends Omit<
  Partial<KeylensConfig>,
  "viewport" | "rules" | "capture" | "interactions" | "timeouts" | "prepare"
> {
  viewport?: Partial<KeylensConfig["viewport"]>;
  rules?: Partial<RuleConfig>;
  capture?: Partial<Omit<CaptureConfig, "limits">> & {
    limits?: Partial<CaptureLimits>;
  };
  interactions?: Partial<InteractionConfig>;
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
  /** Detect composite widget members unreachable via arrow keys despite roving tabindex markup */
  rovingTabindexBroken: boolean;
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
  "page-screenshot" | "html-report" | "json-report" | "markdown-report";

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

export interface AuditTimings {
  crawl: number;
  rules: number;
  total: number;
}

// ─── Crawl Results ───────────────────────────────────────────────

/** All computed style properties for an element, keyed by CSS property name. */
export type ComputedStyleMap = Record<string, string>;

/**
 * Computed style snapshot compared between a focused and unfocused capture of
 * the same element to detect a visible focus indicator (WCAG 2.4.7). Captures
 * the *entire* computed style declaration (not a curated property subset) for
 * the element itself, its ::before/::after pseudo-elements, and a chain of
 * ancestors (for :focus-within patterns, which are commonly applied several
 * levels up — e.g. a form-group/fieldset wrapper around a label+input, not
 * just the element's immediate parent) — any CSS-expressible visual change
 * shows up as a value difference somewhere in one of these maps.
 */
export interface FocusStyleSnapshot {
  self: ComputedStyleMap;
  before: ComputedStyleMap;
  after: ComputedStyleMap;
  /** Computed styles of ancestors, nearest first (index 0 = immediate parent). */
  ancestors?: ComputedStyleMap[];
  /** Computed styles of descendants (bounded breadth-first walk), document order. */
  descendants?: ComputedStyleMap[];
}

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

  /** Element's bounding rectangle in absolute page coordinates (accounts for scroll) */
  pageRect?: BoundingRect;

  /** Computed style snapshot captured the moment this element received focus */
  focusedStyleSnapshot?: FocusStyleSnapshot;

  /** Computed style snapshot captured for this same element once focus moved away */
  unfocusedStyleSnapshot?: FocusStyleSnapshot;

  /**
   * Screenshot pixel-diff second opinion, run only when the computed-style
   * diff found no change (crawler confirmation phase, after the main tab
   * crawl). true = pixels differ (indicator confirmed present despite no
   * style diff — e.g. canvas-painted or portaled indicators); false =
   * pixels also show no change (confirmed missing); undefined = not run
   * (a style diff already existed, or confirmation capture failed/was
   * capped).
   */
  focusIndicatorPixelConfirmed?: boolean;

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
  /**
   * Selector of the nearest ancestor composite widget container (e.g. `[role="tablist"]`)
   * when this element is a roving-tabindex member (e.g. `[role="tab"]`). Null otherwise.
   */
  rovingContainerSelector: string | null;
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

  /** Arrow-key reachability verification results for roving-tabindex composite widgets */
  rovingTabindexGroups?: RovingTabindexGroupResult[];
}

/**
 * Result of verifying that every member of a roving-tabindex composite widget
 * (e.g. a tablist) is actually reachable via arrow keys from the active member -
 * not just assumed from `tabindex="-1"` markup.
 */
export interface RovingTabindexGroupResult {
  /** Selector of the composite container element (e.g. the `[role="tablist"]`) */
  containerSelector: string;

  /** Role of the composite container */
  containerRole: string;

  /** Total number of members discovered in this container */
  totalMembers: number;

  /**
   * Members confirmed reachable via arrow keys, in traversal order (the
   * active/entry member - the one that's a real Tab stop - always comes
   * first). Each entry includes a live-captured page-relative bounding rect
   * so reports can plot these as focus-map markers.
   */
  reachedViaArrowKeys: Array<{ selector: string; pageRect: BoundingRect }>;

  /** Selectors of members that could not be reached via arrow keys */
  unreachedViaArrowKeys: string[];
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
  config: KeylensConfig;

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

  /** Arrow-key reachability verification results for roving-tabindex composite widgets */
  rovingTabindexGroups?: RovingTabindexGroupResult[];

  /** Page dimensions for focus map overlay rendering */
  pageDimensions?: { width: number; height: number };
}
