import { describe, it, expect, vi, afterEach } from "vitest";
import { logger, setLogLevel } from "@/utils/logger.js";

describe("logger", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    logSpy.mockClear();
    errorSpy.mockClear();
    setLogLevel("info");
  });

  describe("log level filtering", () => {
    it("should output debug messages at debug level", () => {
      setLogLevel("debug");
      logger.debug("test debug");

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should suppress debug messages at info level", () => {
      setLogLevel("info");
      logger.debug("test debug");

      expect(logSpy).not.toHaveBeenCalled();
    });

    it("should output info messages at info level", () => {
      setLogLevel("info");
      logger.info("test info");

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should suppress info messages at warn level", () => {
      setLogLevel("warn");
      logger.info("test info");

      expect(logSpy).not.toHaveBeenCalled();
    });

    it("should output warn messages at warn level", () => {
      setLogLevel("warn");
      logger.warn("test warn");

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should suppress everything at silent level", () => {
      setLogLevel("silent");
      logger.debug("test");
      logger.info("test");
      logger.success("test");
      logger.warn("test");
      logger.error("test");

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("error method", () => {
    it("should use console.error", () => {
      setLogLevel("error");
      logger.error("test error");

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("success method", () => {
    it("should output at info level", () => {
      setLogLevel("info");
      logger.success("done");

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should be suppressed at warn level", () => {
      setLogLevel("warn");
      logger.success("done");

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe("rule method", () => {
    it("should output for passed rules", () => {
      logger.rule(true, "test-rule");

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should output for failed rules with detail", () => {
      logger.rule(false, "test-rule", "2 violations");

      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("divider and blank", () => {
    it("should output divider at info level", () => {
      setLogLevel("info");
      logger.divider();

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should suppress divider at warn level", () => {
      setLogLevel("warn");
      logger.divider();

      expect(logSpy).not.toHaveBeenCalled();
    });

    it("should output blank at info level", () => {
      setLogLevel("info");
      logger.blank();

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("should suppress blank at warn level", () => {
      setLogLevel("warn");
      logger.blank();

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
