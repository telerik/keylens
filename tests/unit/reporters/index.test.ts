import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeAuditReport } from "@tests/helpers/factories.js";
import type { MultiPageReport } from "@/types/index.js";

vi.mock("@/reporters/cli-reporter.js", () => ({
  reportCLI: vi.fn(),
  reportMultiCLI: vi.fn(),
}));

vi.mock("@/reporters/json-reporter.js", () => ({
  reportJSON: vi.fn().mockResolvedValue(undefined),
  reportMultiJSON: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/reporters/html-reporter.js", () => ({
  reportHTML: vi.fn().mockResolvedValue(undefined),
  reportMultiHTML: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/reporters/markdown-reporter.js", () => ({
  reportMarkdown: vi.fn().mockResolvedValue(undefined),
  reportMultiMarkdown: vi.fn().mockResolvedValue(undefined),
}));

import { reportCLI, reportMultiCLI } from "@/reporters/cli-reporter.js";
import { reportJSON, reportMultiJSON } from "@/reporters/json-reporter.js";
import { reportHTML, reportMultiHTML } from "@/reporters/html-reporter.js";
import {
  reportMarkdown,
  reportMultiMarkdown,
} from "@/reporters/markdown-reporter.js";

const mockCLI = vi.mocked(reportCLI);
const mockJSON = vi.mocked(reportJSON);
const mockHTML = vi.mocked(reportHTML);
const mockMarkdown = vi.mocked(reportMarkdown);
const mockMultiCLI = vi.mocked(reportMultiCLI);
const mockMultiJSON = vi.mocked(reportMultiJSON);
const mockMultiHTML = vi.mocked(reportMultiHTML);
const mockMultiMarkdown = vi.mocked(reportMultiMarkdown);

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
    expect(mockJSON).toHaveBeenCalledWith(report, "./output");
    expect(mockHTML).not.toHaveBeenCalled();
  });

  it("should call only HTML reporter when reporters is ['html']", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, ["html"], "./output");

    expect(mockCLI).not.toHaveBeenCalled();
    expect(mockJSON).not.toHaveBeenCalled();
    expect(mockHTML).toHaveBeenCalledWith(report, "./output");
  });

  it("should call only markdown reporter when reporters is ['markdown']", async () => {
    const runReporters = await getRunReporters();
    const report = makeAuditReport();

    await runReporters(report, ["markdown"], "./output");

    expect(mockCLI).not.toHaveBeenCalled();
    expect(mockJSON).not.toHaveBeenCalled();
    expect(mockHTML).not.toHaveBeenCalled();
    expect(mockMarkdown).toHaveBeenCalledWith(report, "./output");
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
});

describe("runMultiReporters", () => {
  async function getRunMultiReporters() {
    const mod = await import("@/reporters/index.js");
    return mod.runMultiReporters;
  }

  function makeMultiReport(): MultiPageReport {
    return {
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      urls: ["https://a.com"],
      pages: [makeAuditReport({ url: "https://a.com" })],
      summary: {
        totalPages: 1,
        totalErrors: 0,
        totalWarnings: 0,
        totalInfo: 0,
        pagesWithErrors: 0,
      },
    };
  }

  it("should call multi CLI reporter", async () => {
    const runMultiReporters = await getRunMultiReporters();
    const report = makeMultiReport();

    await runMultiReporters(report, ["cli"], "./output");

    expect(mockMultiCLI).toHaveBeenCalledWith(report);
    expect(mockMultiJSON).not.toHaveBeenCalled();
  });

  it("should call multi JSON reporter with outputDir", async () => {
    const runMultiReporters = await getRunMultiReporters();
    const report = makeMultiReport();

    await runMultiReporters(report, ["json"], "./output");

    expect(mockMultiJSON).toHaveBeenCalledWith(report, "./output");
  });

  it("should call multi HTML reporter with outputDir", async () => {
    const runMultiReporters = await getRunMultiReporters();
    const report = makeMultiReport();

    await runMultiReporters(report, ["html"], "./output");

    expect(mockMultiHTML).toHaveBeenCalledWith(report, "./output");
  });

  it("should call multi markdown reporter with outputDir", async () => {
    const runMultiReporters = await getRunMultiReporters();
    const report = makeMultiReport();

    await runMultiReporters(report, ["markdown"], "./output");

    expect(mockMultiMarkdown).toHaveBeenCalledWith(report, "./output");
  });

  it("should call all multi reporters when all specified", async () => {
    const runMultiReporters = await getRunMultiReporters();
    const report = makeMultiReport();

    await runMultiReporters(
      report,
      ["cli", "json", "html", "markdown"],
      "./output",
    );

    expect(mockMultiCLI).toHaveBeenCalledTimes(1);
    expect(mockMultiJSON).toHaveBeenCalledTimes(1);
    expect(mockMultiHTML).toHaveBeenCalledTimes(1);
    expect(mockMultiMarkdown).toHaveBeenCalledTimes(1);
  });
});
