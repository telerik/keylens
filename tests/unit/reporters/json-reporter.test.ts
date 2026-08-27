import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeAuditReport, makeInlineAsset } from "@tests/helpers/factories.js";

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
});

describe("jsonReporter", () => {
  it("should create output directory and write valid JSON", async () => {
    const { reportJSON: jsonReporter } =
      await import("@/reporters/json-reporter.js");

    const report = makeAuditReport({
      url: "https://example.com",
      summary: {
        totalErrors: 1,
        totalWarnings: 2,
        totalInfo: 0,
        passed: 4,
        failed: 2,
      },
    });

    await jsonReporter(report, "./test-output");

    expect(mockMkdir).toHaveBeenCalledWith("./test-output", {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    // Verify the written content is valid JSON
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.url).toBe("https://example.com");
    expect(parsed.summary.totalErrors).toBe(1);
  });

  it("should omit page screenshot data from JSON output", async () => {
    const { reportJSON: jsonReporter } =
      await import("@/reporters/json-reporter.js");

    const report = makeAuditReport({
      pageScreenshotAssetId: "page",
      assets: [makeInlineAsset("page", "base64-screenshot-data-here")],
      focusSequence: [
        {
          tabIndex: 1,
          selector: "a.link",
          tagName: "a",
          role: "link",
          accessibleName: "Test",
          boundingRect: { x: 0, y: 0, width: 100, height: 40 },
          tabindexAttr: null,
          hasFocusIndicator: null,
          outerHTML: "<a>Test</a>",
        },
      ],
    });

    await jsonReporter(report, "./test-output");

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    expect(writtenContent).not.toContain("base64-screenshot-data-here");
  });
});
