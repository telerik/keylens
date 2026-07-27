import { describe, expect, it } from "vitest";
import {
  cloneAuditReport,
  projectAuditReport,
  projectMultiPageReport,
} from "@/utils/assets.js";
import {
  makeAuditReport,
  makeFocusedElement,
  makeInlineAsset,
  makeMultiPageReport,
} from "@tests/helpers/factories.js";

function makeReportWithAssets() {
  return makeAuditReport({
    pageScreenshotAssetId: "page",
    assets: [
      {
        id: "page",
        type: "page-screenshot",
        mediaType: "image/png",
        byteLength: 4,
        storage: { kind: "inline", data: "cGFnZQ==", encoding: "base64" },
      },
      {
        id: "focused",
        type: "focused-element-screenshot",
        mediaType: "image/png",
        byteLength: 7,
        storage: { kind: "inline", data: "Zm9jdXNlZA==", encoding: "base64" },
      },
    ],
    focusSequence: [
      makeFocusedElement({ focusedScreenshotAssetId: "focused" }),
    ],
  });
}

describe("report asset projections", () => {
  it("omits all asset data and references", () => {
    const projected = projectAuditReport(makeReportWithAssets(), {
      assets: "omit",
    });

    expect(projected.assets).toEqual([]);
    expect(projected.pageScreenshotAssetId).toBeUndefined();
    expect(
      projected.focusSequence?.[0]?.focusedScreenshotAssetId,
    ).toBeUndefined();
    expect(JSON.stringify(projected)).not.toContain("cGFnZQ==");
    expect(JSON.stringify(projected)).not.toContain("Zm9jdXNlZA==");
  });

  it("preserves canonical inline assets without duplicating asset bytes", () => {
    const projected = projectAuditReport(makeReportWithAssets(), {
      assets: "inline",
    });
    const serialized = JSON.stringify(projected);

    expect(projected.pageScreenshotAssetId).toBe("page");
    expect(projected.focusSequence?.[0]?.focusedScreenshotAssetId).toBe(
      "focused",
    );
    expect(projected.assets).toHaveLength(2);
    expect(serialized.match(/cGFnZQ==/g)).toHaveLength(1);
    expect(serialized.match(/Zm9jdXNlZA==/g)).toHaveLength(1);
  });

  it("preserves canonical inline assets when cloning for enrichment", () => {
    const inline = projectAuditReport(makeReportWithAssets(), {
      assets: "inline",
    });

    const cloned = cloneAuditReport(inline);

    expect(cloned.pageScreenshotAssetId).toBe("page");
    expect(cloned.focusSequence?.[0]?.focusedScreenshotAssetId).toBe("focused");
    expect(cloned.assets).toEqual([
      makeInlineAsset("page", "cGFnZQ=="),
      makeInlineAsset("focused", "Zm9jdXNlZA==", "focused-element-screenshot"),
    ]);
  });

  it("replaces inline storage with caller-provided references", () => {
    const projected = projectAuditReport(makeReportWithAssets(), {
      assets: "references",
      reference: (asset) => ({
        kind: "url",
        url: `https://assets.test/${asset.id}`,
      }),
    });

    expect(projected.assets).toEqual([
      expect.objectContaining({
        storage: { kind: "url", url: "https://assets.test/page" },
      }),
      expect.objectContaining({
        storage: { kind: "url", url: "https://assets.test/focused" },
      }),
    ]);
    expect(JSON.stringify(projected)).not.toContain("cGFnZQ==");
  });

  it("projects every page in a multi-page report", () => {
    const report = makeMultiPageReport({
      pages: [makeReportWithAssets(), makeReportWithAssets()],
    });

    const projected = projectMultiPageReport(report, { assets: "omit" });

    expect(projected.pages.every((page) => page.assets.length === 0)).toBe(
      true,
    );
  });

  it("provides page context for collision-free multi-page references", () => {
    const report = makeMultiPageReport({
      pages: [makeReportWithAssets(), makeReportWithAssets()],
    });

    const projected = projectMultiPageReport(report, {
      assets: "references",
      reference: (asset, context) => ({
        kind: "file",
        path: `${context.pageIndex}-${asset.id}.png`,
      }),
    });

    expect(projected.pages[0]?.assets[0]?.storage).toEqual({
      kind: "file",
      path: "0-page.png",
    });
    expect(projected.pages[1]?.assets[0]?.storage).toEqual({
      kind: "file",
      path: "1-page.png",
    });
  });
});
