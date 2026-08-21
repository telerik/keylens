import { describe, expect, it } from "vitest";
import {
  renderHTML,
  renderMarkdown,
  serializeJSON,
  serializeMultiJSON,
} from "@/reporters/index.js";
import { projectAuditReport } from "@/utils/assets.js";
import {
  makeAuditReport,
  makeFocusedElement,
  makeMultiPageReport,
} from "@tests/helpers/factories.js";

describe("in-memory reporters", () => {
  it("renders HTML directly from separated screenshot assets", () => {
    const base = makeAuditReport();
    const report = makeAuditReport({
      config: {
        ...base.config,
        capture: {
          ...base.config.capture,
          page: "full",
        },
      },
      pageScreenshotAssetId: "page",
      assets: [
        {
          id: "page",
          type: "page-screenshot",
          mediaType: "image/png",
          byteLength: 3,
          storage: { kind: "inline", data: "cGFnZQ==", encoding: "base64" },
        },
      ],
      focusSequence: [
        makeFocusedElement({
          pageRect: { x: 10, y: 10, width: 100, height: 40 },
        }),
      ],
      pageDimensions: { width: 1280, height: 720 },
    });

    expect(renderHTML(report)).toContain("data:image/png;base64,cGFnZQ==");
  });

  it("suppresses focus maps for viewport-only screenshots", () => {
    const base = makeAuditReport();
    const report = makeAuditReport({
      config: {
        ...base.config,
        capture: {
          ...base.config.capture,
          page: "viewport",
        },
      },
      pageScreenshotAssetId: "page",
      assets: [
        {
          id: "page",
          type: "page-screenshot",
          mediaType: "image/png",
          byteLength: 3,
          storage: { kind: "inline", data: "cGFnZQ==", encoding: "base64" },
        },
      ],
      focusSequence: [makeFocusedElement()],
    });

    expect(renderHTML(report)).not.toContain("data:image/png;base64,cGFnZQ==");
    expect(
      renderHTML(projectAuditReport(report, { assets: "inline" })),
    ).not.toContain("data:image/png;base64,cGFnZQ==");
  });

  it("renders Markdown without filesystem output", () => {
    expect(renderMarkdown(makeAuditReport())).toContain(
      "# Keylens Keyboard Navigation Report",
    );
  });

  it("serializes canonical compact JSON without asset bytes", () => {
    const report = makeAuditReport({
      pageScreenshotAssetId: "page",
      assets: [
        {
          id: "page",
          type: "page-screenshot",
          mediaType: "image/png",
          byteLength: 3,
          storage: { kind: "inline", data: "cGFnZQ==", encoding: "base64" },
        },
      ],
    });

    const serialized = serializeJSON(report, false);

    expect(serialized).not.toContain("cGFnZQ==");
    expect(JSON.parse(serialized).assets).toEqual([]);
  });

  it("serializes a compact multi-page report without asset bytes", () => {
    const report = makeMultiPageReport();

    const serialized = serializeMultiJSON(report, false);

    expect(JSON.parse(serialized).pages).toBeDefined();
  });
});
