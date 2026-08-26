import { createServer, type Server } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { audit, projectAuditReport } from "../src/index.js";
import { normalizeConfig } from "../src/utils/config.js";
import { setLogLevel } from "../src/utils/logger.js";
import type { AuditReport } from "../src/types/index.js";
import { BENCHMARK_BUDGETS } from "./budgets.js";

interface BenchmarkResult {
  name: string;
  wallTimeMs: number;
  rssStartBytes: number;
  rssPeakBytes: number;
  rssDeltaBytes: number;
  serializedBytes: number;
  compactSerializedBytes: number;
  inlineScreenshotBytes: number;
  interactionResultCount: number;
  focusedElements: number;
}

interface BenchmarkReport {
  generatedAt: string;
  runtime: {
    node: string;
    platform: NodeJS.Platform;
    arch: string;
    cpuCount: number;
  };
  config: {
    tabDelay: number;
    tabTimeout: number;
    maxTabs: number;
    waitAfterLoad: number;
  };
  results: BenchmarkResult[];
}

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixtureNames = ["standard", "interactions"] as const;

function countScreenshotBytes(report: AuditReport): number {
  return report.assets
    .filter((asset) => asset.mediaType.startsWith("image/"))
    .reduce((sum, asset) => sum + asset.byteLength, 0);
}

function countFocusedElements(report: AuditReport): number {
  return report.crawl.totalFocusableElements;
}

function countInteractionResults(report: AuditReport): number {
  return report.crawl.interactions?.attempted ?? 0;
}

async function measure(
  name: string,
  operation: () => Promise<AuditReport>,
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
      projectAuditReport(report, { assets: "omit" }),
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
      interactionResultCount: countInteractionResults(report),
      focusedElements: countFocusedElements(report),
    };
  } finally {
    console.log = originalConsoleLog;
    clearInterval(sampler);
  }
}

function enforceBudgets(results: BenchmarkResult[]): void {
  const failures: string[] = [];
  for (const result of results) {
    const budget = BENCHMARK_BUDGETS[result.name];
    if (!budget) {
      failures.push(`${result.name}: no benchmark budget is defined`);
      continue;
    }
    const checks: Array<[string, number, number]> = [
      ["wallTimeMs", result.wallTimeMs, budget.wallTimeMs],
      ["rssDeltaBytes", result.rssDeltaBytes, budget.rssDeltaBytes],
      [
        "compactSerializedBytes",
        result.compactSerializedBytes,
        budget.compactSerializedBytes,
      ],
    ];
    if (budget.inlineScreenshotBytes !== undefined) {
      checks.push([
        "inlineScreenshotBytes",
        result.inlineScreenshotBytes,
        budget.inlineScreenshotBytes,
      ]);
    }
    for (const [metric, actual, maximum] of checks) {
      if (actual > maximum) {
        failures.push(
          `${result.name}.${metric}: ${actual} exceeds budget ${maximum}`,
        );
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`Benchmark budget failures:\n- ${failures.join("\n- ")}`);
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
    waitAfterLoad: 25,
    tabDelay: 10,
    tabTimeout: 500,
    maxTabs: 150,
  });

  try {
    const results = [
      await measure("standard", () => audit(`${baseUrl}/standard`, baseConfig)),
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
    ];
    const interactionResult = results.find(
      (result) => result.name === "interactions",
    );
    if (!interactionResult || interactionResult.interactionResultCount === 0) {
      throw new Error(
        "Interaction benchmark completed without recording interaction results",
      );
    }

    const report: BenchmarkReport = {
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
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    process.stdout.write(serialized);
    const outputPath = process.env.KEYLENS_BENCHMARK_OUTPUT;
    if (outputPath) await writeFile(outputPath, serialized, "utf8");
    if (process.env.KEYLENS_BENCHMARK_ENFORCE === "1") {
      enforceBudgets(results);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

await main();
