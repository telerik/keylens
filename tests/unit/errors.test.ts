import { describe, it, expect } from "vitest";
import {
  KeylensError,
  CrawlError,
  ConfigError,
  NavigationError,
} from "@/errors.js";

describe("KeylensError", () => {
  it("should set message, code, and name", () => {
    const error = new KeylensError("something broke", "TEST_CODE");

    expect(error.message).toBe("something broke");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("KeylensError");
  });

  it("should be an instance of Error", () => {
    const error = new KeylensError("test", "TEST");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(KeylensError);
  });
});

describe("CrawlError", () => {
  it("should set code to CRAWL_ERROR and preserve url", () => {
    const error = new CrawlError("crawl failed", "https://example.com");

    expect(error.message).toBe("crawl failed");
    expect(error.code).toBe("CRAWL_ERROR");
    expect(error.url).toBe("https://example.com");
    expect(error.name).toBe("CrawlError");
  });

  it("should be an instance of KeylensError and Error", () => {
    const error = new CrawlError("test", "https://example.com");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(KeylensError);
    expect(error).toBeInstanceOf(CrawlError);
  });
});

describe("ConfigError", () => {
  it("should set code to CONFIG_ERROR", () => {
    const error = new ConfigError("bad config");

    expect(error.message).toBe("bad config");
    expect(error.code).toBe("CONFIG_ERROR");
    expect(error.name).toBe("ConfigError");
  });

  it("should be an instance of KeylensError", () => {
    const error = new ConfigError("test");

    expect(error).toBeInstanceOf(KeylensError);
  });
});

describe("NavigationError", () => {
  it("should set code to NAVIGATION_ERROR and preserve url", () => {
    const error = new NavigationError("nav failed", "https://example.com/page");

    expect(error.message).toBe("nav failed");
    expect(error.code).toBe("NAVIGATION_ERROR");
    expect(error.url).toBe("https://example.com/page");
    expect(error.name).toBe("NavigationError");
  });

  it("should be an instance of KeylensError", () => {
    const error = new NavigationError("test", "https://example.com");

    expect(error).toBeInstanceOf(KeylensError);
  });
});
