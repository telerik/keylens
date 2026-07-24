import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, DEFAULT_CONFIG, normalizeConfig } from "@/utils/config.js";
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

describe("normalizeConfig", () => {
  it("normalizes nested partial input without sharing mutable defaults", () => {
    const config = normalizeConfig({
      viewport: { width: 800 },
      rules: { keyboardTrap: false },
      capture: {
        page: "none",
        elements: true,
        limits: { maxElements: 25 },
      },
      timeouts: { total: 60_000 },
    });

    expect(config.viewport).toEqual({ width: 800, height: 720 });
    expect(config.rules.keyboardTrap).toBe(false);
    expect(config.rules.skipLink).toBe(true);
    expect(config.capture.page).toBe("none");
    expect(config.capture.elements).toBe(true);
    expect(config.capture.limits.maxElements).toBe(25);
    expect(config.capture.limits.maxBytes).toBe(
      DEFAULT_CONFIG.capture.limits.maxBytes,
    );
    expect(config.captureElementScreenshots).toBe(true);
    expect(config.timeouts.total).toBe(60_000);

    config.urls.push("https://example.com");
    config.reporters.push("json");
    expect(DEFAULT_CONFIG.urls).toEqual([]);
    expect(DEFAULT_CONFIG.reporters).toEqual(["cli"]);
  });

  it("maps the legacy screenshot option into the new capture contract", () => {
    const config = normalizeConfig({ captureElementScreenshots: true });

    expect(config.captureElementScreenshots).toBe(true);
    expect(config.capture.elements).toBe(true);
  });
});

describe("loadConfig", () => {
  it("should return default config when no path is provided", async () => {
    const config = await loadConfig();

    expect(config.maxTabs).toBe(DEFAULT_CONFIG.maxTabs);
    expect(config.browser).toBe("chromium");
    expect(config.rules.keyboardTrap).toBe(true);
  });

  it("should not share nested mutable values with defaults", async () => {
    const config = await loadConfig();

    config.urls.push("https://example.com");
    config.reporters.push("json");
    config.rules.keyboardTrap = false;

    expect(DEFAULT_CONFIG.urls).toEqual([]);
    expect(DEFAULT_CONFIG.reporters).toEqual(["cli"]);
    expect(DEFAULT_CONFIG.rules.keyboardTrap).toBe(true);
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
        ai: { enabled: true, features: { reportSummary: false } },
      }),
    );

    const config = await loadConfig("custom.json");

    // Overridden values
    expect(config.maxTabs).toBe(200);
    expect(config.viewport.width).toBe(800);
    expect(config.rules.keyboardTrap).toBe(false);
    expect(config.ai.enabled).toBe(true);
    expect(config.ai.features.reportSummary).toBe(false);

    // Preserved defaults
    expect(config.viewport.height).toBe(720);
    expect(config.rules.unreachableElements).toBe(true);
    expect(config.browser).toBe("chromium");
    expect(config.ai.features.fixSuggestions).toBe(true);
  });

  it("should only override specified keys in partial config", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ browser: "firefox" }));

    const config = await loadConfig("minimal.json");

    expect(config.browser).toBe("firefox");
    expect(config.maxTabs).toBe(DEFAULT_CONFIG.maxTabs);
    expect(config.rules).toEqual(DEFAULT_CONFIG.rules);
  });
});
