import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  audit,
  auditMultiple,
  projectAuditReport,
  projectMultiPageReport,
} from "../src/index.js";
import { normalizeConfig } from "../src/utils/config.js";
import { setLogLevel } from "../src/utils/logger.js";
import type { AuditReport, MultiPageReport } from "../src/types/index.js";

interface BenchmarkResult {
  name: string;
  wallTimeMs: number;
  rssStartBytes: number;
  rssPeakBytes: number;
  rssDeltaBytes: number;
  serializedBytes: number;
  compactSerializedBytes: number;
  inlineScreenshotBytes: number;
  elementScreenshotCount: number;
  interactionResultCount: number;
  focusedElements: number;
}

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixtureNames = ["standard", "interactions", "tall"] as const;

function countScreenshotBytes(report: AuditReport | MultiPageReport): number {
  const pages = "pages" in report ? report.pages : [report];
  return pages.reduce(
    (total, page) =>
      total +
      page.assets
        .filter((asset) => asset.mediaType.startsWith("image/"))
        .reduce((sum, asset) => sum + asset.byteLength, 0),
    0,
  );
}

function countFocusedElements(report: AuditReport | MultiPageReport): number {
  return "pages" in report
    ? report.pages.reduce(
        (total, page) => total + page.crawl.totalFocusableElements,
        0,
      )
    : report.crawl.totalFocusableElements;
}

function countElementScreenshots(
  report: AuditReport | MultiPageReport,
): number {
  const pages = "pages" in report ? report.pages : [report];
  return pages.reduce(
    (total, page) =>
      total +
      page.assets.filter(
        (asset) =>
          asset.type === "focused-element-screenshot" ||
          asset.type === "unfocused-element-screenshot",
      ).length,
    0,
  );
}

function countInteractionResults(
  report: AuditReport | MultiPageReport,
): number {
  const pages = "pages" in report ? report.pages : [report];
  return pages.reduce(
    (total, page) => total + (page.crawl.interactions?.attempted ?? 0),
    0,
  );
}

async function measure(
  name: string,
  operation: () => Promise<AuditReport | MultiPageReport>,
): Promise<BenchmarkResult> {
  const rssStartBytes = process.memoryUsage().rss;
  let rssPeakBytes = rssStartBytes;
  const sampler = setInterval(() => {
    rssPeakBytes = Math.max(rssPeakBytes, process.memoryUsage().rss);
  }, 10);
  const startedAt = performance.now();
  const originalConsoleLog = console.log;
  console.log = () => undefined;

  try {
    const report = await operation();
    const serialized = JSON.stringify(report);
    const compact = JSON.stringify(
      "pages" in report
        ? projectMultiPageReport(report, { assets: "omit" })
        : projectAuditReport(report, { assets: "omit" }),
    );
    rssPeakBytes = Math.max(rssPeakBytes, process.memoryUsage().rss);
    return {
      name,
      wallTimeMs: Math.round(performance.now() - startedAt),
      rssStartBytes,
      rssPeakBytes,
      rssDeltaBytes: rssPeakBytes - rssStartBytes,
      serializedBytes: Buffer.byteLength(serialized),
      compactSerializedBytes: Buffer.byteLength(compact),
      inlineScreenshotBytes: countScreenshotBytes(report),
      elementScreenshotCount: countElementScreenshots(report),
      interactionResultCount: countInteractionResults(report),
      focusedElements: countFocusedElements(report),
    };
  } finally {
    console.log = originalConsoleLog;
    clearInterval(sampler);
  }
}

async function startFixtureServer(): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const fixtures = new Map<string, string>();
  await Promise.all(
    fixtureNames.map(async (name) => {
      fixtures.set(
        `/${name}`,
        await readFile(join(fixtureDir, `${name}.html`), "utf8"),
      );
    }),
  );

  const server = createServer((request, response) => {
    const body = fixtures.get(request.url ?? "");
    if (!body) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Benchmark server did not expose a TCP address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function main(): Promise<void> {
  setLogLevel("silent");
  const { server, baseUrl } = await startFixtureServer();
  const baseConfig = normalizeConfig({
    reporters: [],
    ai: { enabled: false },
    waitAfterLoad: 25,
    tabDelay: 10,
    tabTimeout: 500,
    maxTabs: 150,
  });

  try {
    const results = [
      await measure("standard", () => audit(`${baseUrl}/standard`, baseConfig)),
      await measure("element-screenshots", () =>
        audit(
          `${baseUrl}/standard`,
          normalizeConfig({
            ...baseConfig,
            capture: {
              ...baseConfig.capture,
              elements: true,
            },
          }),
        ),
      ),
      await measure("interactions", () =>
        audit(
          `${baseUrl}/interactions`,
          normalizeConfig({
            ...baseConfig,
            interactions: {
              ...baseConfig.interactions,
              enabled: true,
            },
          }),
        ),
      ),
      await measure("multi-page", () =>
        auditMultiple(
          [`${baseUrl}/standard`, `${baseUrl}/tall`, `${baseUrl}/interactions`],
          baseConfig,
        ),
      ),
    ];
    const screenshotResult = results.find(
      (result) => result.name === "element-screenshots",
    );
    if (!screenshotResult || screenshotResult.elementScreenshotCount === 0) {
      throw new Error(
        "Element screenshot benchmark completed without capturing element screenshots",
      );
    }
    const interactionResult = results.find(
      (result) => result.name === "interactions",
    );
    if (!interactionResult || interactionResult.interactionResultCount === 0) {
      throw new Error(
        "Interaction benchmark completed without recording interaction results",
      );
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          runtime: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            cpuCount: navigator.hardwareConcurrency,
          },
          config: {
            tabDelay: baseConfig.tabDelay,
            tabTimeout: baseConfig.tabTimeout,
            maxTabs: baseConfig.maxTabs,
            waitAfterLoad: baseConfig.waitAfterLoad,
          },
          results,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

await main();
