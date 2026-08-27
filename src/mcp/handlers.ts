import { join } from "path";
import {
  audit,
  renderAuditReport,
  getRuleCatalog,
  getRuleRemediation,
} from "../index.js";
import { RULE_CONFIG_MAP } from "../rules/index.js";
import type {
  KeylensConfig,
  KeylensConfigInput,
  AuditReport,
  FocusedElement,
  ReporterType,
  RuleResult,
  RuleRemediation,
  RuleViolation,
  ExecutionProfile,
} from "../types/index.js";
import { normalizeConfig } from "../utils/config.js";
import { setLogLevel } from "../utils/logger.js";

// ─── Types ──────────────────────────────────────────────────────

export interface AuditOptions {
  profile?: ExecutionProfile;
  browser?: "chromium" | "firefox" | "webkit";
  viewport?: { width?: number; height?: number };
  maxTabs?: number;
  tabDelay?: number;
  waitForSelector?: string;
  waitAfterLoad?: number;
  interactions?: boolean;
  reporters?: ReporterType[];
  outputDir?: string;
  keepOverlays?: boolean;
  dismissSelectors?: string[];
}

export interface McpToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ─── Config Builder ─────────────────────────────────────────────

export function buildConfig(options?: AuditOptions): KeylensConfig {
  const input: KeylensConfigInput = {
    reporters: [],
    outputDir: join(process.cwd(), "keylens-report"),
    headed: false,
  };

  const envBrowser = process.env.KEYLENS_BROWSER;
  if (envBrowser) {
    input.browser = envBrowser as KeylensConfig["browser"];
  }

  const envMaxTabs = process.env.KEYLENS_MAX_TABS;
  if (envMaxTabs) {
    input.maxTabs = Number(envMaxTabs);
  }

  if (options) {
    if (options.profile) input.profile = options.profile;
    if (options.browser) input.browser = options.browser;
    if (options.viewport) {
      input.viewport = { ...options.viewport };
    }
    if (options.maxTabs !== undefined) input.maxTabs = options.maxTabs;
    if (options.tabDelay !== undefined) input.tabDelay = options.tabDelay;
    if (options.waitForSelector)
      input.waitForSelector = options.waitForSelector;
    if (options.waitAfterLoad !== undefined)
      input.waitAfterLoad = options.waitAfterLoad;
    if (options.interactions) input.interactions = { enabled: true };
    if (options.keepOverlays) {
      input.prepare = { ...input.prepare, dismissOverlays: false };
    }
    if (options.dismissSelectors?.length) {
      input.prepare = {
        ...input.prepare,
        dismissSelectors: options.dismissSelectors,
      };
    }
    if (options.reporters) input.reporters = options.reporters;
    if (options.outputDir) input.outputDir = options.outputDir;
  }

  return normalizeConfig(input);
}

// ─── Compact Report Helpers (MCP output optimization) ───────────

/**
 * Slim down a FocusedElement to only the fields an LLM needs.
 * Drops: screenshots, outerHTML, boundingRect, pageRect, style snapshots.
 */
function compactElement(el: FocusedElement) {
  return {
    tabIndex: el.tabIndex,
    selector: el.selector,
    tagName: el.tagName,
    role: el.role,
    accessibleName: el.accessibleName,
    tabindexAttr: el.tabindexAttr,
    hasFocusIndicator: el.hasFocusIndicator,
    isObscured: el.isObscured,
  };
}

/**
 * Strip outerHTML from violation elements — selectors are sufficient.
 */
function compactViolation(v: RuleViolation): RuleViolation {
  return {
    ...v,
    elements: v.elements.map(({ selector, tabPosition }) => ({
      selector,
      outerHTML: "",
      tabPosition,
    })),
  };
}

/**
 * Only keep rules that have violations (drop passing rules).
 */
function compactRules(rules: RuleResult[]): RuleResult[] {
  return rules.map((r) => ({
    ...r,
    violations: r.violations.map(compactViolation),
  }));
}

/**
 * Produce a compact single-page report for MCP consumption.
 * Strips: screenshots, outerHTML, boundingRect, pageRect,
 * style snapshots, and the echoed config object.
 */
export function compactReport(report: AuditReport) {
  return {
    schemaVersion: report.schemaVersion,
    version: report.version,
    timestamp: report.timestamp,
    url: report.url,
    crawl: report.crawl,
    rules: compactRules(report.rules),
    summary: report.summary,
    focusSequence: report.focusSequence?.map(compactElement),
    pageDimensions: report.pageDimensions,
  };
}

// ─── Tool Handlers ──────────────────────────────────────────────

/** Attach the RuleConfig key (e.g. "missingFocusIndicator") an agent needs to toggle this rule. */
function withConfigKey(rule: RuleRemediation) {
  return { ...rule, configKey: RULE_CONFIG_MAP[rule.ruleId] };
}

export function handleGetRuleGuidance(params: {
  ruleId?: string;
}): McpToolResponse {
  if (!params.ruleId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(getRuleCatalog().map(withConfigKey)),
        },
      ],
    };
  }

  const rule = getRuleRemediation(params.ruleId);
  if (!rule) {
    return {
      content: [
        {
          type: "text",
          text:
            `Unknown rule "${params.ruleId}". Valid IDs: ` +
            getRuleCatalog()
              .map((r) => r.ruleId)
              .join(", "),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(withConfigKey(rule)) }],
  };
}

export async function handleAudit(params: {
  url: string;
  options?: AuditOptions;
}): Promise<McpToolResponse> {
  setLogLevel("silent");

  try {
    const config = buildConfig(params.options);
    const report = await audit(params.url, config);
    if (config.reporters.length > 0) {
      await renderAuditReport(
        report,
        config.reporters,
        config.outputDir,
        "silent",
      );
    }
    const clean = compactReport(report);
    return {
      content: [{ type: "text", text: JSON.stringify(clean) }],
    };
  } catch (error) {
    return {
      content: [
        { type: "text", text: `Audit failed: ${(error as Error).message}` },
      ],
      isError: true,
    };
  }
}
