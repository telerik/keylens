/**
 * Structured error types for Keylens.
 */

export class KeylensError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "KeylensError";
  }
}

export class CrawlError extends KeylensError {
  constructor(
    message: string,
    public url: string,
  ) {
    super(message, "CRAWL_ERROR");
    this.name = "CrawlError";
  }
}

export class ConfigError extends KeylensError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class NavigationError extends KeylensError {
  constructor(
    message: string,
    public url: string,
  ) {
    super(message, "NAVIGATION_ERROR");
    this.name = "NavigationError";
  }
}
