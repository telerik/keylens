import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "path";
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

  it("confines the write to outputDir even if fileName contains traversal segments", async () => {
    const { writeReportFile } = await import("@/utils/report-writer.js");

    await writeReportFile(
      "./test-output",
      "../../etc/passwd",
      "malicious",
      "JSON",
    );

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath] = mockWriteFile.mock.calls[0]!;
    // basename() strips the traversal segments, so the file still lands
    // inside the resolved output directory.
    expect(String(filePath)).toBe(
      resolve(process.cwd(), "test-output", "passwd"),
    );
  });

  it("confines the write to outputDir even if fileName is an absolute path", async () => {
    const { writeReportFile } = await import("@/utils/report-writer.js");

    await writeReportFile("./test-output", "/etc/passwd", "malicious", "JSON");

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath] = mockWriteFile.mock.calls[0]!;
    expect(String(filePath)).toBe(
      resolve(process.cwd(), "test-output", "passwd"),
    );
  });
});

describe("buildReportFileName", () => {
  it("appends a filesystem-safe timestamp by default", async () => {
    const { buildReportFileName } = await import("@/utils/report-writer.js");

    const name = buildReportFileName(
      "keylens-report",
      "json",
      { appendTimestamp: true },
      "2026-09-14T10:23:05.123Z",
    );

    expect(name).toBe("keylens-report-2026-09-14T10-23-05.json");
  });

  it("omits the timestamp when appendTimestamp is false", async () => {
    const { buildReportFileName } = await import("@/utils/report-writer.js");

    const name = buildReportFileName(
      "keylens-report",
      "html",
      { appendTimestamp: false },
      "2026-09-14T10:23:05.123Z",
    );

    expect(name).toBe("keylens-report.html");
  });

  it("uses outputFileName as the base name when provided", async () => {
    const { buildReportFileName } = await import("@/utils/report-writer.js");

    const name = buildReportFileName(
      "keylens-report",
      "md",
      { outputFileName: "my-site", appendTimestamp: false },
      "2026-09-14T10:23:05.123Z",
    );

    expect(name).toBe("my-site.md");
  });

  it("falls back to the default base name when outputFileName is blank", async () => {
    const { buildReportFileName } = await import("@/utils/report-writer.js");

    const name = buildReportFileName(
      "keylens-report",
      "json",
      { outputFileName: "   ", appendTimestamp: false },
      "2026-09-14T10:23:05.123Z",
    );

    expect(name).toBe("keylens-report.json");
  });

  it("strips directory traversal segments from outputFileName", async () => {
    const { buildReportFileName } = await import("@/utils/report-writer.js");

    const name = buildReportFileName(
      "keylens-report",
      "json",
      { outputFileName: "../../etc/passwd", appendTimestamp: false },
      "2026-09-14T10:23:05.123Z",
    );

    expect(name).toBe("passwd.json");
  });

  it("strips an absolute path down to its base name", async () => {
    const { buildReportFileName } = await import("@/utils/report-writer.js");

    const name = buildReportFileName(
      "keylens-report",
      "json",
      { outputFileName: "/etc/passwd", appendTimestamp: false },
      "2026-09-14T10:23:05.123Z",
    );

    expect(name).toBe("passwd.json");
  });
});
