/**
 * Structured error types for Keylens.
 */

import type { AuditPhase } from "./types/index.js";

export type KeylensErrorCode =
  | "ABORTED"
  | "TIMEOUT"
  | "CONFIG_ERROR"
  | "CRAWL_ERROR"
  | "NAVIGATION_ERROR"
  | "RULE_ERROR"
  | "REPORTER_ERROR"
  | "INTERNAL_ERROR";

export interface KeylensErrorOptions {
  phase?: AuditPhase;
  url?: string;
  retryable?: boolean;
  cause?: unknown;
  details?: Readonly<Record<string, unknown>>;
}

export class KeylensError extends Error {
  public readonly phase?: AuditPhase;
  public readonly url?: string;
  public readonly retryable: boolean;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    public readonly code: KeylensErrorCode,
    options: KeylensErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "KeylensError";
    this.phase = options.phase;
    this.url = options.url;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      phase: this.phase,
      url: this.url,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export class CrawlError extends KeylensError {
  constructor(
    message: string,
    url: string,
    options: Omit<KeylensErrorOptions, "phase" | "url"> = {},
  ) {
    super(message, "CRAWL_ERROR", { phase: "crawl", url, ...options });
    this.name = "CrawlError";
  }
}

export class ConfigError extends KeylensError {
  constructor(
    message: string,
    options: Omit<KeylensErrorOptions, "phase"> = {},
  ) {
    super(message, "CONFIG_ERROR", { phase: "setup", ...options });
    this.name = "ConfigError";
  }
}

export class NavigationError extends KeylensError {
  constructor(
    message: string,
    url: string,
    options: Omit<KeylensErrorOptions, "phase" | "url"> = {},
  ) {
    super(message, "NAVIGATION_ERROR", {
      phase: "navigation",
      url,
      retryable: true,
      ...options,
    });
    this.name = "NavigationError";
  }
}

export class AuditAbortedError extends KeylensError {
  constructor(
    phase: AuditPhase,
    url?: string,
    options: Omit<KeylensErrorOptions, "phase" | "url"> = {},
  ) {
    super("Audit aborted", "ABORTED", {
      phase,
      url,
      ...options,
    });
    this.name = "AuditAbortedError";
  }
}

export class AuditTimeoutError extends KeylensError {
  constructor(
    phase: AuditPhase,
    timeoutMs: number,
    url?: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(`Audit ${phase} phase timed out after ${timeoutMs}ms`, "TIMEOUT", {
      phase,
      url,
      retryable: true,
      details: { timeoutMs, ...details },
    });
    this.name = "AuditTimeoutError";
  }
}

export class ReporterError extends KeylensError {
  constructor(
    message: string,
    url?: string,
    options: Omit<KeylensErrorOptions, "phase" | "url"> = {},
  ) {
    super(message, "REPORTER_ERROR", {
      phase: "reporters",
      url,
      ...options,
    });
    this.name = "ReporterError";
  }
}
