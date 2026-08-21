import type {
  AssetProjectionOptions,
  AuditAsset,
  AuditReport,
} from "../types/index.js";
import { ConfigError } from "../errors.js";

export function getInlineAssetData(
  assets: readonly AuditAsset[],
  assetId: string | undefined,
): string | undefined {
  if (!assetId) return undefined;
  const asset = assets.find((candidate) => candidate.id === assetId);
  return asset?.storage.kind === "inline" ? asset.storage.data : undefined;
}

function cloneReportShell(report: AuditReport): AuditReport {
  const { assets: _assets, ...semantic } = report;
  void _assets;
  return {
    ...structuredClone(semantic),
    assets: [],
  };
}

export function cloneAuditReport(report: AuditReport): AuditReport {
  const cloned = cloneReportShell(report);
  cloned.assets = (report.assets ?? []).map((asset) => ({
    ...asset,
    storage: { ...asset.storage },
  }));
  return cloned;
}

export function projectAuditReport(
  report: AuditReport,
  options: AssetProjectionOptions,
): AuditReport {
  if (options.assets === "inline") {
    return cloneAuditReport(report);
  }
  return projectAuditReportWithoutInlineData(report, options);
}

function projectAuditReportWithoutInlineData(
  report: AuditReport,
  options: AssetProjectionOptions,
  pageIndex?: number,
): AuditReport {
  const projected = cloneReportShell(report);

  projected.focusSequence = projected.focusSequence?.map((element) => {
    const copy = { ...element };
    if (options.assets === "omit") {
      delete copy.focusedScreenshotAssetId;
      delete copy.unfocusedScreenshotAssetId;
    }
    return copy;
  });

  if (options.assets === "omit") {
    delete projected.pageScreenshotAssetId;
    projected.assets = [];
  } else if (options.assets === "references") {
    if (!options.reference) {
      throw new ConfigError(
        "Asset references projection requires a reference callback",
      );
    }
    projected.assets = (report.assets ?? []).map((asset) => {
      const { storage, ...metadata } = asset;
      return {
        ...metadata,
        storage:
          storage.kind === "inline"
            ? options.reference!(asset, { url: report.url, pageIndex })
            : { ...storage },
      };
    });
  }

  return projected;
}
