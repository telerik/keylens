import { readFile } from "fs/promises";
import { resolve } from "path";
import type { KeylensConfig } from "../types/index.js";
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
  captureElementScreenshots: false,
  interactions: false,
};

/**
 * Load configuration from a JSON file and merge with defaults.
 */
export async function loadConfig(configPath?: string): Promise<KeylensConfig> {
  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  const fullPath = resolve(process.cwd(), configPath);

  try {
    const raw = await readFile(fullPath, "utf-8");
    const fileConfig = JSON.parse(raw) as Partial<KeylensConfig>;
    return mergeConfig(DEFAULT_CONFIG, fileConfig);
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
function mergeConfig(
  base: KeylensConfig,
  overrides: Partial<KeylensConfig>,
): KeylensConfig {
  return {
    ...base,
    ...overrides,
    viewport: { ...base.viewport, ...overrides.viewport },
    rules: { ...base.rules, ...overrides.rules },
    ai: {
      ...base.ai,
      ...overrides.ai,
      features: {
        ...base.ai.features,
        ...overrides.ai?.features,
      },
      limits: {
        ...base.ai.limits,
        ...overrides.ai?.limits,
      },
    },
  };
}
