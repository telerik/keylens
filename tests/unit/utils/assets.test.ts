import { describe, expect, it } from "vitest";
import { cloneAuditReport, projectAuditReport } from "@/utils/assets.js";
import { makeAuditReport, makeInlineAsset } from "@tests/helpers/factories.js";

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
    expect(JSON.stringify(projected)).not.toContain("cGFnZQ==");
  });

  it("preserves canonical inline assets without duplicating asset bytes", () => {
    const projected = projectAuditReport(makeReportWithAssets(), {
      assets: "inline",
    });
    const serialized = JSON.stringify(projected);

    expect(projected.pageScreenshotAssetId).toBe("page");
    expect(projected.assets).toHaveLength(1);
    expect(serialized.match(/cGFnZQ==/g)).toHaveLength(1);
  });

  it("preserves canonical inline assets when cloning for enrichment", () => {
    const inline = projectAuditReport(makeReportWithAssets(), {
      assets: "inline",
    });

    const cloned = cloneAuditReport(inline);

    expect(cloned.pageScreenshotAssetId).toBe("page");
    expect(cloned.assets).toEqual([makeInlineAsset("page", "cGFnZQ==")]);
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
    ]);
    expect(JSON.stringify(projected)).not.toContain("cGFnZQ==");
  });

  it("requires a reference callback for reference projections", () => {
    expect(() =>
      projectAuditReport(makeReportWithAssets(), { assets: "references" }),
    ).toThrow("Asset references projection requires a reference callback");
  });
});
