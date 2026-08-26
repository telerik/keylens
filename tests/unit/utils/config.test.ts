import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadConfig,
  loadConfigInput,
  DEFAULT_CONFIG,
  normalizeConfig,
} from "@/utils/config.js";
import { ConfigError } from "@/errors.js";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "fs/promises";
const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeConfig", () => {
  it("normalizes nested partial input without sharing mutable defaults", () => {
    const config = normalizeConfig({
      viewport: { width: 800 },
      rules: { keyboardTrap: false },
      capture: {
        page: "none",
        limits: { maxDimension: 4096 },
      },
      timeouts: { total: 60_000 },
      interactions: {
        enabled: true,
        maxCases: 3,
        actions: ["enter"],
      },
    });

    expect(config.viewport).toEqual({ width: 800, height: 720 });
    expect(config.rules.keyboardTrap).toBe(false);
    expect(config.rules.skipLink).toBe(true);
    expect(config.capture.page).toBe("none");
    expect(config.capture.limits.maxDimension).toBe(4096);
    expect(config.capture.limits.maxBytes).toBe(
      DEFAULT_CONFIG.capture.limits.maxBytes,
    );
    expect(config.timeouts.total).toBe(60_000);
    expect(config.interactions).toEqual(
      expect.objectContaining({
        enabled: true,
        maxCases: 3,
        actions: ["enter"],
        isolation: "reload",
      }),
    );

    config.reporters.push("json");
    expect(DEFAULT_CONFIG.reporters).toEqual(["cli"]);
  });

  it("rejects fractional capture dimension limits", () => {
    expect(() =>
      normalizeConfig({ capture: { limits: { maxDimension: 1.5 } } }),
    ).toThrow("capture.limits.maxDimension");
  });

  it("rejects invalid interaction limits", () => {
    expect(() => normalizeConfig({ interactions: { maxCases: -1 } })).toThrow(
      "interactions.maxCases",
    );
    expect(() => normalizeConfig({ interactions: { timeout: 0 } })).toThrow(
      "interactions.timeout",
    );
    expect(() =>
      normalizeConfig({ interactions: { timeout: Number.NaN } }),
    ).toThrow("interactions.timeout");
  });

  it("applies execution profiles before explicit overrides", () => {
    expect(normalizeConfig({ profile: "fast" })).toMatchObject({
      profile: "fast",
      maxTabs: 400,
      tabTimeout: 500,
      waitAfterLoad: 250,
      tabDelay: 25,
    });
    expect(
      normalizeConfig({ profile: "thorough", tabDelay: 750 }),
    ).toMatchObject({
      profile: "thorough",
      maxTabs: 1000,
      tabDelay: 750,
    });
  });

  it("rejects unknown options with their configuration path", () => {
    expect(() => normalizeConfig({ unknownOption: true } as never)).toThrow(
      "unknownOption",
    );
    expect(() => normalizeConfig({ rules: { typo: true } } as never)).toThrow(
      "rules.typo",
    );
  });

  describe("prepare", () => {
    it("defaults to auto-dismissing overlays with a reject-first preference", () => {
      const config = normalizeConfig({});
      expect(config.prepare).toMatchObject({
        dismissOverlays: true,
        consentPreference: "reject",
        timeout: 5_000,
      });
      expect(config.prepare.dismissSelectors).toBeUndefined();
      expect(config.prepare.steps).toBeUndefined();
    });

    it("supports disabling overlay dismissal via --keep-overlays semantics", () => {
      const config = normalizeConfig({ prepare: { dismissOverlays: false } });
      expect(config.prepare.dismissOverlays).toBe(false);
      expect(config.prepare.consentPreference).toBe("reject");
    });

    it("merges custom selectors, cookies, and steps without dropping defaults", () => {
      const config = normalizeConfig({
        prepare: {
          consentPreference: "accept",
          dismissSelectors: ["#banner .close"],
          cookies: [{ name: "consent", value: "1" }],
          steps: [{ type: "press", key: "Escape" }],
        },
      });
      expect(config.prepare).toMatchObject({
        dismissOverlays: true,
        consentPreference: "accept",
        dismissSelectors: ["#banner .close"],
      });
      expect(config.prepare.cookies).toEqual([{ name: "consent", value: "1" }]);
      expect(config.prepare.steps).toEqual([{ type: "press", key: "Escape" }]);
    });

    it("rejects an invalid consent preference", () => {
      expect(() =>
        normalizeConfig({
          prepare: { consentPreference: "necessary" as never },
        }),
      ).toThrow("prepare.consentPreference");
    });

    it("rejects a malformed prepare step", () => {
      expect(() =>
        normalizeConfig({
          prepare: { steps: [{ type: "click" } as never] },
        }),
      ).toThrow(/prepare\.steps/);
    });
  });
});

describe("loadConfig", () => {
  it("preserves omitted fields when loading raw CLI input", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ url: "https://x.test" }));

    const input = await loadConfigInput("minimal.json");

    expect(input.capture).toBeUndefined();
  });

  it("validates config files and strips the schema hint", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        $schema: "./keylens.config.schema.json",
        profile: "fast",
      }),
    );

    const input = await loadConfigInput("profile.json");

    expect(input).toEqual({ profile: "fast" });
  });

  it("should return default config when no path is provided", async () => {
    const config = await loadConfig();

    expect(config.maxTabs).toBe(DEFAULT_CONFIG.maxTabs);
    expect(config.browser).toBe("chromium");
    expect(config.rules.keyboardTrap).toBe(true);
  });

  it("should not share nested mutable values with defaults", async () => {
    const config = await loadConfig();

    config.reporters.push("json");
    config.rules.keyboardTrap = false;
    config.interactions.actions.push("space");

    expect(DEFAULT_CONFIG.reporters).toEqual(["cli"]);
    expect(DEFAULT_CONFIG.rules.keyboardTrap).toBe(true);
    expect(DEFAULT_CONFIG.interactions.actions).toEqual(["click"]);
  });

  it("should throw ConfigError when file is not found", async () => {
    mockReadFile.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    await expect(loadConfig("nonexistent.json")).rejects.toThrow(ConfigError);
    await expect(loadConfig("nonexistent.json")).rejects.toThrow(
      "Config file not found",
    );
  });

  it("should throw ConfigError for invalid JSON", async () => {
    mockReadFile.mockResolvedValue("{ not valid json }");

    await expect(loadConfig("bad.json")).rejects.toThrow(ConfigError);
    await expect(loadConfig("bad.json")).rejects.toThrow(
      "Failed to parse config file",
    );
  });

  it("should deep merge partial config with defaults", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        maxTabs: 200,
        viewport: { width: 800 },
        rules: { keyboardTrap: false },
      }),
    );

    const config = await loadConfig("custom.json");

    // Overridden values
    expect(config.maxTabs).toBe(200);
    expect(config.viewport.width).toBe(800);
    expect(config.rules.keyboardTrap).toBe(false);

    // Preserved defaults
    expect(config.viewport.height).toBe(720);
    expect(config.rules.unreachableElements).toBe(true);
    expect(config.browser).toBe("chromium");
  });

  it("should only override specified keys in partial config", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ browser: "firefox" }));

    const config = await loadConfig("minimal.json");

    expect(config.browser).toBe("firefox");
    expect(config.maxTabs).toBe(DEFAULT_CONFIG.maxTabs);
    expect(config.rules).toEqual(DEFAULT_CONFIG.rules);
  });
});
