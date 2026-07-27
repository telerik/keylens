import { readFile } from "fs/promises";
import { resolve } from "path";
import type {
  AIConfig,
  KeylensConfig,
  KeylensConfigInput,
} from "../types/index.js";
import { ConfigError } from "../errors.js";

export const DEFAULT_CONFIG: KeylensConfig = {
  urls: [],
  viewport: { width: 1280, height: 720 },
  maxTabs: 500,
  tabTimeout: 3000,
  waitAfterLoad: 1000,
  tabDelay: 250,
  rules: {
    keyboardTrap: true,
    unreachableElements: true,
    focusOrderMismatch: true,
    tabindexAbuse: true,
    missingFocusIndicator: true,
    skipLink: true,
    focusNotObscured: true,
    focusAfterInteraction: true,
  },
  reporters: ["cli"],
  outputDir: "./keylens-report",
  browser: "chromium",
  ai: {
    enabled: false,
    provider: "anthropic",
    features: {
      focusOrderValidation: true,
      fixSuggestions: true,
      widgetClassification: false,
      reportSummary: true,
      focusIndicatorQuality: false,
      accessibleNameInference: false,
      crossPagePatterns: true,
    },
    limits: {
      batchSize: 10,
      maxWidgets: 20,
      maxElements: 10,
    },
  },
  navigationTimeout: 30_000,
  headed: false,
  interactions: false,
  capture: {
    page: "none",
    elements: false,
    limits: {
      maxElements: 200,
      maxDimension: 16_384,
      maxPixels: 40_000_000,
      maxBytes: 50 * 1024 * 1024,
    },
  },
  timeouts: {},
};

export function resolveAIAPIKey(config: AIConfig): string | undefined {
  return (
    config.apiKey ||
    process.env.KEYLENS_AI_API_KEY ||
    (config.provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY)
  );
}

export function hasConfiguredAIAPIKey(config: AIConfig): boolean {
  return resolveAIAPIKey(config) !== undefined;
}

/**
 * Load configuration from a JSON file and merge with defaults.
 */
export async function loadConfig(configPath?: string): Promise<KeylensConfig> {
  if (!configPath) {
    return normalizeConfig();
  }
  return normalizeConfig(await loadConfigInput(configPath));
}

export async function loadConfigInput(
  configPath: string,
): Promise<KeylensConfigInput> {
  const fullPath = resolve(process.cwd(), configPath);

  try {
    const raw = await readFile(fullPath, "utf-8");
    return JSON.parse(raw) as KeylensConfigInput;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigError(`Config file not found: ${fullPath}`);
    }
    throw new ConfigError(
      `Failed to parse config file: ${(error as Error).message}`,
    );
  }
}

/**
 * Deep merge two config objects, with overrides taking precedence.
 */
export function normalizeConfig(
  overrides: KeylensConfigInput = {},
): KeylensConfig {
  const maxElements =
    overrides.capture?.limits?.maxElements ??
    DEFAULT_CONFIG.capture.limits.maxElements ??
    200;
  if (!Number.isSafeInteger(maxElements) || maxElements < 0) {
    throw new ConfigError(
      "capture.limits.maxElements must be a non-negative integer",
    );
  }

  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    urls: [...(overrides.urls ?? DEFAULT_CONFIG.urls)],
    viewport: { ...DEFAULT_CONFIG.viewport, ...overrides.viewport },
    rules: { ...DEFAULT_CONFIG.rules, ...overrides.rules },
    reporters: [...(overrides.reporters ?? DEFAULT_CONFIG.reporters)],
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...overrides.ai,
      features: {
        ...DEFAULT_CONFIG.ai.features,
        ...overrides.ai?.features,
      },
      limits: {
        ...DEFAULT_CONFIG.ai.limits,
        ...overrides.ai?.limits,
      },
    },
    capture: {
      ...DEFAULT_CONFIG.capture,
      ...overrides.capture,
      elements: overrides.capture?.elements ?? DEFAULT_CONFIG.capture.elements,
      limits: {
        ...DEFAULT_CONFIG.capture.limits,
        ...overrides.capture?.limits,
        maxElements,
      },
    },
    timeouts: {
      ...DEFAULT_CONFIG.timeouts,
      ...overrides.timeouts,
    },
  };
}
