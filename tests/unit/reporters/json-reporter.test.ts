import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeAuditReport,
  makeMultiPageReport,
  makeFocusedElement,
} from "@tests/helpers/factories.js";

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

  it("should strip screenshots from JSON output", async () => {
    const { reportJSON: jsonReporter } =
      await import("@/reporters/json-reporter.js");

    const report = makeAuditReport({
      pageScreenshot: "base64-screenshot-data-here",
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
          focusedScreenshot: "focused-screenshot-data",
          unfocusedScreenshot: "unfocused-screenshot-data",
          outerHTML: "<a>Test</a>",
        },
      ],
    });

    await jsonReporter(report, "./test-output");

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    expect(writtenContent).not.toContain("base64-screenshot-data-here");
    expect(writtenContent).not.toContain("focused-screenshot-data");
    expect(writtenContent).not.toContain("unfocused-screenshot-data");
  });
});

describe("reportMultiJSON", () => {
  it("should create output directory and write valid JSON", async () => {
    const { reportMultiJSON } = await import("@/reporters/json-reporter.js");

    const report = makeMultiPageReport({
      urls: ["https://a.com", "https://b.com"],
      pages: [
        makeAuditReport({ url: "https://a.com" }),
        makeAuditReport({ url: "https://b.com" }),
      ],
      summary: {
        totalPages: 2,
        totalErrors: 1,
        totalWarnings: 3,
        totalInfo: 0,
        pagesWithErrors: 1,
      },
    });

    await reportMultiJSON(report, "./test-output");

    expect(mockMkdir).toHaveBeenCalledWith("./test-output", {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.urls).toEqual(["https://a.com", "https://b.com"]);
    expect(parsed.summary.totalPages).toBe(2);
    expect(parsed.summary.totalErrors).toBe(1);
    expect(parsed.pages).toHaveLength(2);
  });

  it("should strip screenshots from all pages", async () => {
    const { reportMultiJSON } = await import("@/reporters/json-reporter.js");

    const report = makeMultiPageReport({
      pages: [
        makeAuditReport({
          url: "https://a.com",
          pageScreenshot: "page-screenshot-a",
          focusSequence: [
            makeFocusedElement({
              focusedScreenshot: "focused-a",
              unfocusedScreenshot: "unfocused-a",
            }),
          ],
        }),
        makeAuditReport({
          url: "https://b.com",
          pageScreenshot: "page-screenshot-b",
        }),
      ],
    });

    await reportMultiJSON(report, "./test-output");

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    expect(writtenContent).not.toContain("page-screenshot-a");
    expect(writtenContent).not.toContain("page-screenshot-b");
    expect(writtenContent).not.toContain("focused-a");
    expect(writtenContent).not.toContain("unfocused-a");
  });

  it("should preserve non-screenshot data in pages", async () => {
    const { reportMultiJSON } = await import("@/reporters/json-reporter.js");

    const report = makeMultiPageReport({
      pages: [
        makeAuditReport({
          url: "https://example.com",
          summary: {
            totalErrors: 2,
            totalWarnings: 1,
            totalInfo: 0,
            passed: 4,
            failed: 2,
          },
        }),
      ],
    });

    await reportMultiJSON(report, "./test-output");

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.pages[0].url).toBe("https://example.com");
    expect(parsed.pages[0].summary.totalErrors).toBe(2);
  });
});
