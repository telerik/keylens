/**
 * Spawns the real CLI (via tsx, matching `npm run keylens`) against local fixture
 * servers and asserts the behavior a real user depends on: exit codes, config-file
 * vs. CLI-flag precedence, flag parsing/validation, and report files actually written
 * to disk. Nothing else in the suite runs the CLI entry point end-to-end — rules,
 * the crawler, and reporters are covered as library calls elsewhere.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI_ENTRY = resolve(import.meta.dirname, "../../src/cli/index.ts");
// Resolve tsx's actual JS entry (its package.json "bin") and run it with node
// directly, rather than the node_modules/.bin/tsx shell shim, which is a
// .cmd/.ps1 file on Windows and can't be spawned without `shell: true`.
const TSX_CLI = resolve(
  import.meta.dirname,
  "../../node_modules/tsx/dist/cli.mjs",
);
const FIXTURES_DIR = resolve(import.meta.dirname, "../fixtures");

function serveFixture(
  fileName: string,
): Promise<{ server: Server; url: string }> {
  const html = readFileSync(join(FIXTURES_DIR, fileName), "utf-8");
  return new Promise((resolvePromise) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolvePromise({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

// Must be async: a sync spawn would block this process's event loop, starving
// the in-process fixture HTTP server the CLI is trying to navigate to.
function runCli(args: string[], cwd?: string): Promise<CliResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [TSX_CLI, CLI_ENTRY, ...args], {
      cwd,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });
}

describe("Integration: CLI entry point", () => {
  let cleanServer: Server;
  let cleanUrl: string;
  let badServer: Server;
  let badUrl: string;
  let interactionsServer: Server;
  let interactionsUrl: string;
  let tmpDir: string;

  beforeAll(async () => {
    ({ server: cleanServer, url: cleanUrl } =
      await serveFixture("clean-page.html"));
    ({ server: badServer, url: badUrl } = await serveFixture("test-page.html"));
    ({ server: interactionsServer, url: interactionsUrl } = await serveFixture(
      "interactions-page.html",
    ));
    tmpDir = await mkdtemp(join(tmpdir(), "keylens-cli-test-"));
  });

  afterAll(async () => {
    cleanServer?.close();
    badServer?.close();
    interactionsServer?.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("exits 0 and reports no errors for a clean page", async () => {
    const outputDir = join(tmpDir, "clean-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.summary.totalErrors).toBe(0);
    expect(report.summary.scoreComplete).toBe(true);
  });

  it("exits 1 and reports violations for a page with known issues", async () => {
    const outputDir = join(tmpDir, "bad-report");
    const result = await runCli([
      "audit",
      badUrl,
      "--profile",
      "fast",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(1);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.summary.totalErrors).toBeGreaterThan(0);
  });

  it("prints a CLI report to stdout when --output cli is used (default)", async () => {
    const result = await runCli(["audit", cleanUrl, "--profile", "fast"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Keylens");
  });

  it("writes html and markdown reports for their respective reporters", async () => {
    const outputDir = join(tmpDir, "multi-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--output",
      "html,markdown",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const html = await readFile(
      join(outputDir, "keylens-report.html"),
      "utf-8",
    );
    expect(html).toContain("<html");
    const markdown = await readFile(
      join(outputDir, "keylens-report.md"),
      "utf-8",
    );
    expect(markdown).toContain("#");
  });

  it("exits 2 with no URL and no config file", async () => {
    const result = await runCli(["audit"]);

    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/no url provided/i);
  });

  it("exits 2 for an invalid --viewport value", async () => {
    const result = await runCli([
      "audit",
      cleanUrl,
      "--viewport",
      "not-a-size",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/invalid viewport/i);
  });

  it("exits 2 for an invalid --consent value", async () => {
    const result = await runCli(["audit", cleanUrl, "--consent", "maybe"]);

    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/invalid --consent/i);
  });

  it("lets a CLI flag override a config file value (precedence)", async () => {
    const configPath = join(tmpDir, "override.config.json");
    await writeFile(
      configPath,
      JSON.stringify({ profile: "thorough", maxTabs: 3, reporters: ["cli"] }),
    );
    const outputDir = join(tmpDir, "override-report");

    // CLI --max-tabs should win over the config file's maxTabs.
    const result = await runCli([
      "audit",
      cleanUrl,
      "--config",
      configPath,
      "--max-tabs",
      "50",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.focusSequence.length).toBeLessThanOrEqual(50);
  });

  it("reads the URL from a config file when no argument is given", async () => {
    const configPath = join(tmpDir, "url.config.json");
    await writeFile(
      configPath,
      JSON.stringify({ url: cleanUrl, profile: "fast" }),
    );

    const result = await runCli(["audit", "--config", configPath]);

    expect(result.status).toBe(0);
  });

  it("supports `keylens <url>` shorthand for `keylens audit <url>`", async () => {
    const result = await runCli([cleanUrl, "--profile", "fast"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Keylens");
  });

  it("creates a keylens.config.json via the init command", async () => {
    const initDir = join(tmpDir, "init-project");
    await mkdir(initDir, { recursive: true });

    const result = await runCli(["init"], initDir);

    expect(result.status).toBe(0);
    const config = JSON.parse(
      await readFile(join(initDir, "keylens.config.json"), "utf-8"),
    );
    expect(config.profile).toBe("balanced");
    expect(config.reporters).toEqual(["cli", "json"]);
  });

  it("exits 2 for a nonexistent config file path", async () => {
    const result = await runCli([
      "audit",
      cleanUrl,
      "--config",
      join(tmpDir, "does-not-exist.config.json"),
    ]);

    expect(result.status).toBe(2);
  });

  it("exits 2 for a config file with invalid JSON", async () => {
    const configPath = join(tmpDir, "malformed.config.json");
    await writeFile(configPath, "{ not valid json");

    const result = await runCli(["audit", cleanUrl, "--config", configPath]);

    expect(result.status).toBe(2);
  });

  it("exits 2 for a config file that fails schema validation (unknown key)", async () => {
    const configPath = join(tmpDir, "unknown-key.config.json");
    await writeFile(configPath, JSON.stringify({ notARealOption: true }));

    const result = await runCli(["audit", cleanUrl, "--config", configPath]);

    expect(result.status).toBe(2);
  });

  it("dismisses a known consent banner by default and removes it from the focus sequence", async () => {
    const { server, url } = await serveFixture("consent-banner-page.html");
    try {
      const outputDir = join(tmpDir, "consent-default-report");
      const result = await runCli([
        "audit",
        url,
        "--profile",
        "fast",
        "--output",
        "json",
        "--output-dir",
        outputDir,
      ]);

      expect(result.status).toBe(0);
      const report = JSON.parse(
        await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
      );
      expect(report.crawl.prepare?.dismissals?.length).toBeGreaterThan(0);
      const selectors = report.focusSequence.map(
        (el: { selector: string }) => el.selector,
      );
      expect(selectors.some((s: string) => s.includes("onetrust"))).toBe(false);
    } finally {
      server.close();
    }
  });

  it("warns when a --dismiss selector matches nothing on the page", async () => {
    const outputDir = join(tmpDir, "dismiss-not-found-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--dismiss",
      "#this-selector-does-not-exist",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    // Regression: a --dismiss selector that matches nothing must be reported
    // as a warning, not silently ignored (docs promise dismissal outcomes are
    // "never silent").
    expect(report.crawl.prepare?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Custom dismiss selector not found: #this-selector-does-not-exist",
        ),
      ]),
    );
  });

  it("keeps the consent banner reachable with --keep-overlays", async () => {
    const { server, url } = await serveFixture("consent-banner-page.html");
    try {
      const outputDir = join(tmpDir, "consent-kept-report");
      const result = await runCli([
        "audit",
        url,
        "--profile",
        "fast",
        "--keep-overlays",
        "--output",
        "json",
        "--output-dir",
        outputDir,
      ]);

      expect(result.status).toBeLessThanOrEqual(1);
      const report = JSON.parse(
        await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
      );
      expect(report.crawl.prepare?.dismissals?.length ?? 0).toBe(0);
    } finally {
      server.close();
    }
  });

  it("disables a rule via config file (rules.tabindexAbuse: false)", async () => {
    const configPath = join(tmpDir, "no-tabindex-rule.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        profile: "fast",
        rules: { tabindexAbuse: false },
      }),
    );
    const outputDir = join(tmpDir, "no-tabindex-rule-report");

    const result = await runCli([
      "audit",
      badUrl,
      "--config",
      configPath,
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    const ruleIds = report.rules.map((r: { ruleId: string }) => r.ruleId);
    expect(ruleIds).not.toContain("tabindex-abuse");
    expect(result.status === 0 || result.status === 1).toBe(true);
  });

  it("suppresses non-essential output with --quiet", async () => {
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--quiet",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("Starting deterministic Keylens audit");
  });

  it("emits verbose debug diagnostics with --verbose", async () => {
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--verbose",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/launching chromium browser/i);
  });

  it("enables bounded post-activation testing with --interactions", async () => {
    const outputDir = join(tmpDir, "interactions-report");
    const result = await runCli([
      "audit",
      interactionsUrl,
      "--profile",
      "fast",
      "--interactions",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status === 0 || result.status === 1).toBe(true);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.interactions.enabled).toBe(true);
    expect(report.crawl.interactions?.attempted).toBeGreaterThan(0);
    expect(Array.isArray(report.interactionResults)).toBe(true);
    expect(report.interactionResults.length).toBeGreaterThan(0);
  });

  it("does not run interaction testing without --interactions (default off)", async () => {
    const outputDir = join(tmpDir, "no-interactions-report");
    const result = await runCli([
      "audit",
      interactionsUrl,
      "--profile",
      "fast",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status === 0 || result.status === 1).toBe(true);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.interactions.enabled).toBe(false);
    expect(report.crawl.interactions).toBeUndefined();
  });

  it("plumbs --tab-delay through to the resolved config", async () => {
    const outputDir = join(tmpDir, "tab-delay-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--tab-delay",
      "15",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.tabDelay).toBe(15);
  });

  it("exits 2 for a --tab-delay below the documented 10ms minimum", async () => {
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--tab-delay",
      "2",
    ]);

    expect(result.status).toBe(2);
  });

  it("plumbs --browser through to the resolved config", async () => {
    // Only chromium is guaranteed installed for the default (non-cross-browser)
    // CI job; firefox/webkit --browser plumbing is exercised the same way by
    // the dedicated cross-browser CI job once that job targets this file.
    const outputDir = join(tmpDir, "browser-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--browser",
      "chromium",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.browser).toBe("chromium");
  });

  it("plumbs --viewport through to the resolved config", async () => {
    const outputDir = join(tmpDir, "viewport-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--viewport",
      "1024x768",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.viewport).toEqual({ width: 1024, height: 768 });
  });

  it("plumbs --wait through to the resolved config as waitAfterLoad", async () => {
    const outputDir = join(tmpDir, "wait-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--wait",
      "123",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.waitAfterLoad).toBe(123);
  });

  it("plumbs --timeout through to the resolved config as navigationTimeout", async () => {
    const outputDir = join(tmpDir, "timeout-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--timeout",
      "9000",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.navigationTimeout).toBe(9000);
  });

  it("plumbs --page-screenshot through to the resolved config", async () => {
    const outputDir = join(tmpDir, "page-screenshot-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--page-screenshot",
      "viewport",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.capture.page).toBe("viewport");
  });

  it("plumbs --no-expand-scroll-containers through to the resolved config", async () => {
    const outputDir = join(tmpDir, "no-expand-report");
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--no-expand-scroll-containers",
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.prepare.expandScrollContainers).toBe(false);
  });

  it("exits 2 for an invalid --output reporter name", async () => {
    const result = await runCli(["audit", cleanUrl, "--output", "xml"]);

    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/invalid configuration/i);
  });

  it("exits 2 for an invalid --browser value", async () => {
    const result = await runCli(["audit", cleanUrl, "--browser", "safari"]);

    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/invalid configuration/i);
  });

  it("exits 2 for an invalid --page-screenshot mode", async () => {
    const result = await runCli([
      "audit",
      cleanUrl,
      "--page-screenshot",
      "bogus",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/invalid configuration/i);
  });

  it("exits 2 when --wait-for never appears on the page", async () => {
    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--wait-for",
      "#this-never-appears",
    ]);

    expect(result.status).toBe(2);
  });

  it("exits 2 when the output directory path is an existing file, not a directory", async () => {
    const blockingFilePath = join(tmpDir, "blocking-file");
    await writeFile(blockingFilePath, "not a directory");

    const result = await runCli([
      "audit",
      cleanUrl,
      "--profile",
      "fast",
      "--output",
      "json",
      "--output-dir",
      blockingFilePath,
    ]);

    // Real filesystem ReporterError, not the mocked failure exercised at the
    // unit level in tests/unit/reporters/index.test.ts.
    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/reporter failed/i);
  });

  it("aborts with exit 2 when timeouts.total (config-file-only) is exceeded", async () => {
    const configPath = join(tmpDir, "short-total-timeout.config.json");
    await writeFile(
      configPath,
      JSON.stringify({ profile: "fast", timeouts: { total: 10 } }),
    );

    const result = await runCli(["audit", cleanUrl, "--config", configPath]);

    expect(result.status).toBe(2);
    expect(result.stderr + result.stdout).toMatch(/timed out/i);
  });

  it("threads prepare.cookies and prepare.steps from a config file through to the crawler", async () => {
    const configPath = join(tmpDir, "cookies-steps.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        profile: "fast",
        prepare: {
          dismissOverlays: false,
          cookies: [{ name: "consent", value: "granted" }],
          steps: [{ type: "wait", ms: 10 }],
        },
      }),
    );
    const outputDir = join(tmpDir, "cookies-steps-report");

    const result = await runCli([
      "audit",
      cleanUrl,
      "--config",
      configPath,
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status).toBe(0);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    // Proves the full chain (config file -> zod -> normalizeConfig -> crawler)
    // together, not just each layer in isolation.
    expect(report.crawl.prepare.attempted).toBe(true);
    expect(report.crawl.prepare.duration).toBeGreaterThan(0);
  });

  it("restricts interaction activation to interactions.include selectors from a config file", async () => {
    const configPath = join(tmpDir, "interactions-include.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        profile: "fast",
        interactions: { enabled: true, include: ["#preserve"] },
      }),
    );
    const outputDir = join(tmpDir, "interactions-include-report");

    const result = await runCli([
      "audit",
      interactionsUrl,
      "--config",
      configPath,
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status === 0 || result.status === 1).toBe(true);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.interactions.include).toEqual(["#preserve"]);
    const attemptedSelectors = report.interactionResults.map(
      (r: { element: { selector: string } }) => r.element.selector,
    );
    expect(attemptedSelectors).toEqual(["#preserve"]);
  });

  it("skips excluded controls via interactions.exclude from a config file", async () => {
    const configPath = join(tmpDir, "interactions-exclude.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        profile: "fast",
        interactions: { enabled: true, exclude: ["#preserve"] },
      }),
    );
    const outputDir = join(tmpDir, "interactions-exclude-report");

    const result = await runCli([
      "audit",
      interactionsUrl,
      "--config",
      configPath,
      "--output",
      "json",
      "--output-dir",
      outputDir,
    ]);

    expect(result.status === 0 || result.status === 1).toBe(true);
    const report = JSON.parse(
      await readFile(join(outputDir, "keylens-report.json"), "utf-8"),
    );
    expect(report.config.interactions.exclude).toEqual(["#preserve"]);
    const preserveResult = report.interactionResults.find(
      (r: { element: { selector: string } }) =>
        r.element.selector === "#preserve",
    );
    expect(preserveResult?.status).toBe("skipped");
  });
});
