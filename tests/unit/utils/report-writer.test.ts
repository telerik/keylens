import { describe, it, expect, vi, beforeEach } from "vitest";
import { setLogLevel } from "@/utils/logger.js";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, writeFile } from "fs/promises";
const mockMkdir = vi.mocked(mkdir);
const mockWriteFile = vi.mocked(writeFile);

beforeEach(() => {
  vi.clearAllMocks();
  setLogLevel("silent");
});

describe("writeReportFile", () => {
  it("creates the output directory and writes the file with the given name and content", async () => {
    const { writeReportFile } = await import("@/utils/report-writer.js");

    await writeReportFile("./test-output", "keylens-report.json", "{}", "JSON");

    expect(mockMkdir).toHaveBeenCalledWith("./test-output", {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, content, options] = mockWriteFile.mock.calls[0]!;
    expect(String(filePath)).toMatch(/keylens-report\.json$/);
    expect(content).toBe("{}");
    expect(options).toMatchObject({ encoding: "utf-8" });
  });

  it("falls back to process.cwd() when outputDir is empty", async () => {
    const { writeReportFile } = await import("@/utils/report-writer.js");

    await writeReportFile("", "keylens-report.md", "# Report", "Markdown");

    expect(mockMkdir).toHaveBeenCalledWith(process.cwd(), {
      recursive: true,
    });
  });

  it("passes the abort signal through to writeFile", async () => {
    const { writeReportFile } = await import("@/utils/report-writer.js");
    const controller = new AbortController();

    await writeReportFile(
      "./out",
      "keylens-report.html",
      "<html></html>",
      "HTML",
      controller.signal,
    );

    const [, , options] = mockWriteFile.mock.calls[0]!;
    expect(options).toMatchObject({ signal: controller.signal });
  });

  it("rejects before creating the directory when the signal is already aborted", async () => {
    const { writeReportFile } = await import("@/utils/report-writer.js");
    const controller = new AbortController();
    controller.abort();

    await expect(
      writeReportFile(
        "./out",
        "keylens-report.json",
        "{}",
        "JSON",
        controller.signal,
        "https://example.com",
      ),
    ).rejects.toMatchObject({ code: "ABORTED", phase: "reporters" });

    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("rejects after mkdir when the signal aborts before the write", async () => {
    const controller = new AbortController();
    mockMkdir.mockImplementationOnce(async () => {
      controller.abort();
      return undefined;
    });
    const { writeReportFile } = await import("@/utils/report-writer.js");

    await expect(
      writeReportFile(
        "./out",
        "keylens-report.json",
        "{}",
        "JSON",
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "ABORTED", phase: "reporters" });

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
