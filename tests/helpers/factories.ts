import type {
  FocusedElement,
  InteractiveElement,
  CrawlResult,
  AuditReport,
  MultiPageReport,
} from "@/types/index.js";
import { AUDIT_REPORT_SCHEMA_VERSION } from "@/types/index.js";

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
    pageScreenshot: "",
    crawlDuration: 1000,
    ...overrides,
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
    config: {},
    crawl: {
      totalFocusableElements: 0,
      totalInteractiveElements: 0,
      unreachedElements: 0,
      cycleCompleted: true,
      duration: 1000,
    },
    rules: [],
    summary: {
      totalErrors: 0,
      totalWarnings: 0,
      totalInfo: 0,
      passed: 0,
      failed: 0,
      score: 100,
    },
    ...overrides,
  };
}

export function makeMultiPageReport(
  overrides: Partial<MultiPageReport> = {},
): MultiPageReport {
  return {
    schemaVersion: AUDIT_REPORT_SCHEMA_VERSION,
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    urls: ["https://example.com"],
    pages: [makeAuditReport()],
    summary: {
      totalPages: 1,
      totalErrors: 0,
      totalWarnings: 0,
      totalInfo: 0,
      pagesWithErrors: 0,
      score: 100,
    },
    ...overrides,
  };
}
