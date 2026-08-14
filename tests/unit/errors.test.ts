import { describe, it, expect } from "vitest";
import {
  KeylensError,
  CrawlError,
  ConfigError,
  NavigationError,
  AuditAbortedError,
  AuditTimeoutError,
  AIError,
} from "@/errors.js";

describe("KeylensError", () => {
  it("should set message, code, and name", () => {
    const error = new KeylensError("something broke", "INTERNAL_ERROR");

    expect(error.message).toBe("something broke");
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.name).toBe("KeylensError");
  });

  it("should be an instance of Error", () => {
    const error = new KeylensError("test", "INTERNAL_ERROR");

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
    expect(error.phase).toBe("crawl");
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
    expect(error.phase).toBe("setup");
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
    expect(error.phase).toBe("navigation");
    expect(error.retryable).toBe(true);
  });

  it("should be an instance of KeylensError", () => {
    const error = new NavigationError("test", "https://example.com");

    expect(error).toBeInstanceOf(KeylensError);
  });
});

describe("AIError", () => {
  it("should set code to AI_ERROR and phase to ai", () => {
    const error = new AIError("@anthropic-ai/sdk is not installed");

    expect(error.message).toBe("@anthropic-ai/sdk is not installed");
    expect(error.code).toBe("AI_ERROR");
    expect(error.name).toBe("AIError");
    expect(error.phase).toBe("ai");
  });

  it("should be an instance of KeylensError and Error", () => {
    const error = new AIError("test");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(KeylensError);
    expect(error).toBeInstanceOf(AIError);
  });

  it("accepts optional url and cause metadata", () => {
    const cause = new Error("network down");
    const error = new AIError("Unsupported AI provider: mistral", {
      url: "https://example.com",
      cause,
    });

    expect(error.url).toBe("https://example.com");
    expect(error.cause).toBe(cause);
  });
});

describe("structured error metadata", () => {
  it("serializes stable diagnostics without a stack trace or cause", () => {
    const error = new KeylensError("timed out", "TIMEOUT", {
      phase: "crawl",
      url: "https://example.com",
      retryable: true,
      cause: new Error("internal"),
      details: { timeoutMs: 1000 },
    });

    expect(error.toJSON()).toEqual({
      name: "KeylensError",
      message: "timed out",
      code: "TIMEOUT",
      phase: "crawl",
      url: "https://example.com",
      retryable: true,
      details: { timeoutMs: 1000 },
    });
    expect(error.cause).toBeInstanceOf(Error);
  });
});

describe("cancellation errors", () => {
  it("represents caller cancellation with stable metadata", () => {
    const error = new AuditAbortedError("crawl", "https://example.com");

    expect(error).toMatchObject({
      name: "AuditAbortedError",
      code: "ABORTED",
      phase: "crawl",
      url: "https://example.com",
      retryable: false,
    });
  });

  it("includes the enforced timeout budget", () => {
    const error = new AuditTimeoutError("rules", 250, "https://example.com");

    expect(error).toMatchObject({
      name: "AuditTimeoutError",
      code: "TIMEOUT",
      phase: "rules",
      retryable: true,
      details: { timeoutMs: 250 },
    });
  });
});
