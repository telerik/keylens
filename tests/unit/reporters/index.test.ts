import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeAuditReport } from "@tests/helpers/factories.js";
import { ReporterError } from "@/errors.js";

vi.mock("@/reporters/cli-reporter.js", () => ({
  reportCLI: vi.fn(),
}));

vi.mock("@/reporters/json-reporter.js", () => ({
  reportJSON: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/reporters/html-reporter.js", () => ({
  reportHTML: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/reporters/markdown-reporter.js", () => ({
  reportMarkdown: vi.fn().mockResolvedValue(undefined),
}));

import { reportCLI } from "@/reporters/cli-reporter.js";
import { reportJSON } from "@/reporters/json-reporter.js";
import { reportHTML } from "@/reporters/html-reporter.js";
import { reportMarkdown } from "@/reporters/markdown-reporter.js";

const mockCLI = vi.mocked(reportCLI);
const mockJSON = vi.mocked(reportJSON);
const mockHTML = vi.mocked(reportHTML);
const mockMarkdown = vi.mocked(reportMarkdown);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runReporters", () => {
  async function getRunReporters() {
    const mod = await import("@/reporters/index.js");
    return mod.runReporters;
  }

  it("should call only CLI reporter when reporters is ['cli']", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, ["cli"], "./output");

    expect(mockCLI).toHaveBeenCalledWith(report);
    expect(mockJSON).not.toHaveBeenCalled();
    expect(mockHTML).not.toHaveBeenCalled();
  });

  it("should call only JSON reporter when reporters is ['json']", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, ["json"], "./output");

    expect(mockCLI).not.toHaveBeenCalled();
    expect(mockJSON).toHaveBeenCalledWith(report, "./output", undefined);
    expect(mockHTML).not.toHaveBeenCalled();
  });

  it("should call only HTML reporter when reporters is ['html']", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, ["html"], "./output");

    expect(mockCLI).not.toHaveBeenCalled();
    expect(mockJSON).not.toHaveBeenCalled();
    expect(mockHTML).toHaveBeenCalledWith(report, "./output", undefined);
  });

  it("should call only markdown reporter when reporters is ['markdown']", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, ["markdown"], "./output");

    expect(mockCLI).not.toHaveBeenCalled();
    expect(mockJSON).not.toHaveBeenCalled();
    expect(mockHTML).not.toHaveBeenCalled();
    expect(mockMarkdown).toHaveBeenCalledWith(report, "./output", undefined);
  });

  it("should call all reporters when all four are specified", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, ["cli", "json", "html", "markdown"], "./output");

    expect(mockCLI).toHaveBeenCalledTimes(1);
    expect(mockJSON).toHaveBeenCalledTimes(1);
    expect(mockHTML).toHaveBeenCalledTimes(1);
    expect(mockMarkdown).toHaveBeenCalledTimes(1);
  });

  it("should call no reporters when list is empty", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, [], "./output");

    expect(mockCLI).not.toHaveBeenCalled();
    expect(mockJSON).not.toHaveBeenCalled();
    expect(mockHTML).not.toHaveBeenCalled();
    expect(mockMarkdown).not.toHaveBeenCalled();
  });

  it("does not start output after cancellation", async () => {
    const runReporters = await getRunReporters();
    const controller = new AbortController();
    controller.abort();

    await expect(
      runReporters(
        makeAuditReport(),
        ["json", "html"],
        "./output",
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "ABORTED", phase: "reporters" });
    expect(mockJSON).not.toHaveBeenCalled();
    expect(mockHTML).not.toHaveBeenCalled();
  });

  it("wraps reporter failures with structured diagnostics", async () => {
    const runReporters = await getRunReporters();
    mockJSON.mockRejectedValueOnce(new Error("disk full"));

    await expect(
      runReporters(makeAuditReport(), ["json"], "./output"),
    ).rejects.toMatchObject({
      code: "REPORTER_ERROR",
      phase: "reporters",
      message: "Reporter failed: disk full",
    });
  });

  it("re-throws a ReporterError as-is instead of re-wrapping it", async () => {
    const runReporters = await getRunReporters();
    const original = new ReporterError(
      "already structured",
      "https://example.com",
    );
    mockJSON.mockRejectedValueOnce(original);

    await expect(
      runReporters(makeAuditReport(), ["json"], "./output"),
    ).rejects.toBe(original);
  });
});
