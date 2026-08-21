import type {
  FocusedElement,
  FocusStyleSnapshot,
  InteractiveElement,
  CrawlResult,
  AuditReport,
  AuditAsset,
} from "@/types/index.js";
import { AUDIT_REPORT_SCHEMA_VERSION } from "@/types/index.js";
import { DEFAULT_CONFIG, normalizeConfig } from "@/utils/config.js";

export function makeFocusedElement(
  overrides: Partial<FocusedElement> = {},
): FocusedElement {
  return {
    tabIndex: 1,
    selector: "button.test",
    tagName: "button",
    role: "button",
    accessibleName: "Test Button",
    boundingRect: { x: 0, y: 0, width: 100, height: 40 },
    tabindexAttr: null,
    hasFocusIndicator: null,
    outerHTML: '<button class="test">Test Button</button>',
    ...overrides,
  };
}

export function makeFocusStyleSnapshot(
  overrides: {
    self?: Partial<FocusStyleSnapshot["self"]>;
    before?: Partial<FocusStyleSnapshot["before"]>;
    after?: Partial<FocusStyleSnapshot["after"]>;
    parent?: Partial<NonNullable<FocusStyleSnapshot["parent"]>>;
  } = {},
): FocusStyleSnapshot {
  const baseSelf = {
    "outline-style": "none",
    "outline-width": "0px",
    "outline-color": "rgb(0, 0, 0)",
    "outline-offset": "0px",
    "box-shadow": "none",
    "border-top-style": "none",
    "border-top-width": "0px",
    "border-top-color": "rgb(0, 0, 0)",
    "background-color": "rgba(0, 0, 0, 0)",
    color: "rgb(0, 0, 0)",
    "text-decoration-line": "none",
    "text-decoration-color": "rgb(0, 0, 0)",
    filter: "none",
    "background-image": "none",
    "animation-name": "none",
    "animation-duration": "0s",
  };
  const basePseudo = {
    content: "none",
    "box-shadow": "none",
    "background-color": "rgba(0, 0, 0, 0)",
    width: "0px",
    height: "0px",
    opacity: "1",
    transform: "none",
  };
  const baseParent = {
    "box-shadow": "none",
    "background-color": "rgba(0, 0, 0, 0)",
    "outline-style": "none",
  };

  return {
    self: { ...baseSelf, ...overrides.self },
    before: { ...basePseudo, ...overrides.before },
    after: { ...basePseudo, ...overrides.after },
    parent: { ...baseParent, ...overrides.parent },
  };
}

export function makeInteractiveElement(
  overrides: Partial<InteractiveElement> = {},
): InteractiveElement {
  return {
    selector: "button.test",
    tagName: "button",
    role: "button",
    accessibleName: "Test",
    boundingRect: { x: 0, y: 0, width: 100, height: 40 },
    reached: false,
    tabindexAttr: null,
    outerHTML: "<button>Test</button>",
    rovingContainerSelector: null,
    ...overrides,
  };
}

export function makeCrawlResult(
  overrides: Partial<CrawlResult> = {},
): CrawlResult {
  return {
    url: "https://example.com",
    focusSequence: [],
    interactiveElements: [],
    cycleCompleted: true,
    assets: [],
    crawlDuration: 1000,
    capture: {
      attempted: 0,
      captured: 0,
      skipped: 0,
      failed: 0,
      byteLength: 0,
      decodedPixels: 0,
    },
    ...overrides,
  };
}

export function makeInlineAsset(
  id: string,
  data: string,
  type: AuditAsset["type"] = "page-screenshot",
): AuditAsset {
  return {
    id,
    type,
    mediaType: "image/png",
    byteLength: Buffer.from(data, "base64").byteLength,
    storage: { kind: "inline", data, encoding: "base64" },
  };
}

export function makeAuditReport(
  overrides: Partial<AuditReport> = {},
): AuditReport {
  return {
    schemaVersion: AUDIT_REPORT_SCHEMA_VERSION,
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    url: "https://example.com",
    config: {
      ...normalizeConfig(DEFAULT_CONFIG),
      ai: {
        ...DEFAULT_CONFIG.ai,
        apiKeyConfigured: false,
        transportConfigured: false,
      },
    },
    timings: {
      crawl: 1000,
      rules: 0,
      total: 1000,
    },
    crawl: {
      totalFocusableElements: 0,
      totalInteractiveElements: 0,
      unreachedElements: 0,
      cycleCompleted: true,
      duration: 1000,
      capture: {
        attempted: 0,
        captured: 0,
        skipped: 0,
        failed: 0,
        byteLength: 0,
        decodedPixels: 0,
      },
    },
    rules: [],
    summary: {
      totalErrors: 0,
      totalWarnings: 0,
      totalInfo: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      score: 100,
      scoreComplete: true,
    },
    assets: [],
    ...overrides,
  };
}
