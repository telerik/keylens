import { readFile } from "fs/promises";
import { resolve } from "path";
import type {
  AIConfig,
  ExecutionProfile,
  KeylensConfig,
  KeylensConfigInput,
} from "../types/index.js";
import { ConfigError } from "../errors.js";
import { z } from "zod";

export const DEFAULT_CONFIG: KeylensConfig = {
  profile: "balanced",
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
  interactions: {
    enabled: false,
    maxCases: 20,
    timeout: 2_000,
    actions: ["click"],
    isolation: "reload",
    navigation: "block",
    excludeDestructive: true,
  },
  multiPage: {
    concurrency: 2,
  },
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
  prepare: {
    dismissOverlays: true,
    consentPreference: "reject",
    timeout: 5_000,
    expandScrollContainers: true,
  },
};

export const EXECUTION_PROFILES: Readonly<
  Record<
    ExecutionProfile,
    Pick<KeylensConfig, "maxTabs" | "tabTimeout" | "waitAfterLoad" | "tabDelay">
  >
> = {
  fast: {
    maxTabs: 400,
    tabTimeout: 500,
    waitAfterLoad: 250,
    tabDelay: 25,
  },
  balanced: {
    maxTabs: 500,
    tabTimeout: 3_000,
    waitAfterLoad: 1_000,
    tabDelay: 250,
  },
  thorough: {
    maxTabs: 1_000,
    tabTimeout: 5_000,
    waitAfterLoad: 2_000,
    tabDelay: 500,
  },
};

const positiveNumber = z.number().finite().positive();
const nonNegativeNumber = z.number().finite().nonnegative();
const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().nonnegative();

export const KEYLENS_CONFIG_INPUT_SCHEMA = z
  .object({
    $schema: z.string().optional(),
    profile: z.enum(["fast", "balanced", "thorough"]).optional(),
    urls: z.array(z.url()).optional(),
    viewport: z
      .object({
        width: positiveNumber.optional(),
        height: positiveNumber.optional(),
      })
      .strict()
      .optional(),
    maxTabs: positiveInteger.optional(),
    tabTimeout: positiveNumber.optional(),
    waitForSelector: z.string().min(1).optional(),
    waitAfterLoad: nonNegativeNumber.optional(),
    tabDelay: z.number().finite().min(10).optional(),
    rules: z
      .object({
        keyboardTrap: z.boolean().optional(),
        unreachableElements: z.boolean().optional(),
        focusOrderMismatch: z.boolean().optional(),
        tabindexAbuse: z.boolean().optional(),
        missingFocusIndicator: z.boolean().optional(),
        skipLink: z.boolean().optional(),
        focusNotObscured: z.boolean().optional(),
        focusAfterInteraction: z.boolean().optional(),
      })
      .strict()
      .optional(),
    reporters: z.array(z.enum(["cli", "json", "html", "markdown"])).optional(),
    outputDir: z.string().min(1).optional(),
    browser: z.enum(["chromium", "firefox", "webkit"]).optional(),
    navigationTimeout: positiveNumber.optional(),
    headed: z.boolean().optional(),
    interactions: z
      .object({
        enabled: z.boolean().optional(),
        maxCases: nonNegativeInteger.optional(),
        timeout: positiveNumber.optional(),
        include: z.array(z.string().min(1)).optional(),
        exclude: z.array(z.string().min(1)).optional(),
        actions: z.array(z.enum(["click", "enter", "space"])).optional(),
        isolation: z.enum(["reload", "none"]).optional(),
        navigation: z.enum(["block", "allow"]).optional(),
        excludeDestructive: z.boolean().optional(),
      })
      .strict()
      .optional(),
    multiPage: z
      .object({ concurrency: positiveInteger.optional() })
      .strict()
      .optional(),
    capture: z
      .object({
        page: z.enum(["none", "viewport", "full"]).optional(),
        elements: z.boolean().optional(),
        limits: z
          .object({
            maxElements: nonNegativeInteger.optional(),
            maxDimension: positiveInteger.optional(),
            maxPixels: positiveInteger.optional(),
            maxBytes: positiveInteger.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    timeouts: z
      .object({
        total: positiveNumber.optional(),
        crawl: positiveNumber.optional(),
        rules: positiveNumber.optional(),
        interactions: positiveNumber.optional(),
        ai: positiveNumber.optional(),
        reporters: positiveNumber.optional(),
      })
      .strict()
      .optional(),
    prepare: z
      .object({
        dismissOverlays: z.boolean().optional(),
        consentPreference: z.enum(["reject", "accept", "close"]).optional(),
        dismissSelectors: z.array(z.string().min(1)).optional(),
        timeout: positiveNumber.optional(),
        expandScrollContainers: z.boolean().optional(),
        cookies: z
          .array(
            z
              .object({
                name: z.string().min(1),
                value: z.string(),
                domain: z.string().min(1).optional(),
                path: z.string().min(1).optional(),
              })
              .strict(),
          )
          .optional(),
        steps: z
          .array(
            z.discriminatedUnion("type", [
              z
                .object({
                  type: z.literal("click"),
                  selector: z.string().min(1),
                  optional: z.boolean().optional(),
                })
                .strict(),
              z
                .object({
                  type: z.literal("press"),
                  key: z.string().min(1),
                })
                .strict(),
              z
                .object({
                  type: z.literal("wait"),
                  ms: nonNegativeNumber,
                })
                .strict(),
              z
                .object({
                  type: z.literal("waitFor"),
                  selector: z.string().min(1),
                  timeout: positiveNumber.optional(),
                })
                .strict(),
            ]),
          )
          .optional(),
      })
      .strict()
      .optional(),
    ai: z
      .object({
        enabled: z.boolean().optional(),
        provider: z.enum(["anthropic", "openai"]).optional(),
        apiKey: z.string().optional(),
        model: z.string().min(1).optional(),
        baseURL: z.url().optional(),
        transport: z
          .custom<
            NonNullable<AIConfig["transport"]>
          >((value) => typeof value === "object" && value !== null && typeof (value as AIConfig["transport"])?.query === "function" && typeof (value as AIConfig["transport"])?.queryVision === "function", "transport must implement query() and queryVision()")
          .optional(),
        features: z
          .object({
            focusOrderValidation: z.boolean().optional(),
            fixSuggestions: z.boolean().optional(),
            widgetClassification: z.boolean().optional(),
            reportSummary: z.boolean().optional(),
            focusIndicatorQuality: z.boolean().optional(),
            accessibleNameInference: z.boolean().optional(),
            crossPagePatterns: z.boolean().optional(),
          })
          .strict()
          .optional(),
        limits: z
          .object({
            batchSize: positiveInteger.optional(),
            maxWidgets: positiveInteger.optional(),
            maxElements: positiveInteger.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function validateConfigInput(input: unknown): KeylensConfigInput {
  const parsed = KEYLENS_CONFIG_INPUT_SCHEMA.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => {
        if (issue.code === "unrecognized_keys") {
          return issue.keys
            .map((key) => {
              const path = [...issue.path, key].join(".");
              return `${path}: Unrecognized option`;
            })
            .join(", ");
        }
        const path = issue.path.length > 0 ? issue.path.join(".") : "config";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw new ConfigError(`Invalid configuration: ${issues}`);
  }
  const { $schema: _schema, ...config } = parsed.data;
  void _schema;
  return config as KeylensConfigInput;
}

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
    return validateConfigInput(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigError(`Config file not found: ${fullPath}`);
    }
    if (error instanceof ConfigError) throw error;
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
  const validated = validateConfigInput(overrides);
  const profile = validated.profile ?? DEFAULT_CONFIG.profile;
  const profileConfig = EXECUTION_PROFILES[profile];
  const input = { ...profileConfig, ...validated };
  const maxElements =
    input.capture?.limits?.maxElements ??
    DEFAULT_CONFIG.capture.limits.maxElements ??
    200;
  const maxCases =
    input.interactions?.maxCases ?? DEFAULT_CONFIG.interactions.maxCases;
  const concurrency =
    input.multiPage?.concurrency ?? DEFAULT_CONFIG.multiPage.concurrency;

  return {
    ...DEFAULT_CONFIG,
    ...input,
    profile,
    urls: [...(input.urls ?? DEFAULT_CONFIG.urls)],
    viewport: { ...DEFAULT_CONFIG.viewport, ...input.viewport },
    rules: { ...DEFAULT_CONFIG.rules, ...input.rules },
    reporters: [...(input.reporters ?? DEFAULT_CONFIG.reporters)],
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...input.ai,
      features: {
        ...DEFAULT_CONFIG.ai.features,
        ...input.ai?.features,
      },
      limits: {
        ...DEFAULT_CONFIG.ai.limits,
        ...input.ai?.limits,
      },
    },
    capture: {
      ...DEFAULT_CONFIG.capture,
      ...input.capture,
      elements: input.capture?.elements ?? DEFAULT_CONFIG.capture.elements,
      limits: {
        ...DEFAULT_CONFIG.capture.limits,
        ...input.capture?.limits,
        maxElements,
      },
    },
    interactions: {
      ...DEFAULT_CONFIG.interactions,
      ...input.interactions,
      maxCases,
      actions: [
        ...(input.interactions?.actions ?? DEFAULT_CONFIG.interactions.actions),
      ],
      include: input.interactions?.include
        ? [...input.interactions.include]
        : undefined,
      exclude: input.interactions?.exclude
        ? [...input.interactions.exclude]
        : undefined,
    },
    multiPage: {
      ...DEFAULT_CONFIG.multiPage,
      ...input.multiPage,
      concurrency,
    },
    timeouts: {
      ...DEFAULT_CONFIG.timeouts,
      ...input.timeouts,
    },
    prepare: {
      ...DEFAULT_CONFIG.prepare,
      ...input.prepare,
      dismissSelectors: input.prepare?.dismissSelectors
        ? [...input.prepare.dismissSelectors]
        : undefined,
      cookies: input.prepare?.cookies
        ? [...input.prepare.cookies]
        : undefined,
      steps: input.prepare?.steps ? [...input.prepare.steps] : undefined,
    },
  };
}
