import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const testHome = vi.hoisted(() => ({ dir: "" }));
const machineIdMock = vi.hoisted(() => ({
  fn: vi.fn(async () => ({
    id: "mocked-machine-id",
    fingerprint: "",
    algorithm: "SHA256" as const,
  })),
}));

// Redirect the notice state file into a throwaway temp dir so tests never
// touch the real machine's ~/.keylens (and stay isolated from each other).
vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: () => testHome.dir };
});

// Never let a unit test spawn real OS hardware-id lookups.
vi.mock("@telerik/machine-id", () => ({
  default: machineIdMock.fn,
  loadMachineId: machineIdMock.fn,
}));

import {
  recordAuditFailure,
  recordAuditSuccess,
  toCallHomeSource,
} from "@/telemetry/context.js";
import { _resetCallHomeClientForTests } from "@/telemetry/call-home-client.js";
import {
  ENV_KEYLENS_TELEMETRY_OFF,
  ENV_TELERIK_TELEMETRY_OFF,
  Source,
} from "@/telemetry/constants.js";
import { ConfigError } from "@/errors.js";
import { makeAuditReport } from "../../helpers/factories.js";

const ENV_KEYLENS_TELEMETRY_API_KEY = "KEYLENS_TELEMETRY_IDENTITY_API_KEY";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;
const report = makeAuditReport();

function fakeFetch(): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    if (url.toString().includes("example.org")) {
      return new Response(
        JSON.stringify({
          access_token: "fake-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
}

describe("telemetry context (call-home)", () => {
  beforeEach(() => {
    testHome.dir = mkdtempSync(join(tmpdir(), "keylens-telemetry-home-"));
    process.env = { ...ORIGINAL_ENV };
    delete process.env[ENV_KEYLENS_TELEMETRY_API_KEY];
    delete process.env[ENV_KEYLENS_TELEMETRY_OFF];
    delete process.env[ENV_TELERIK_TELEMETRY_OFF];
    machineIdMock.fn.mockClear();
    _resetCallHomeClientForTests();
    global.fetch = fakeFetch();
  });

  afterEach(() => {
    rmSync(testHome.dir, { recursive: true, force: true });
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
    _resetCallHomeClientForTests();
  });

  it("is dormant by default — no API key means nothing happens", async () => {
    await recordAuditSuccess(report, Source.Cli);
    expect(machineIdMock.fn).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("posts to Call-Home once an API key is configured", async () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "fake-api-key";
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    await recordAuditSuccess(report, Source.Cli);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [tokenCall, eventCall] = (global.fetch as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(tokenCall[0]).toContain("example.org");
    expect(eventCall[0]).toContain("/events/callhome");
    expect(JSON.parse(eventCall[1].body).MachineId).toBe("mocked-machine-id");
  });

  it("records a failure event with a fixed error code, via recordAuditFailure", async () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "fake-api-key";
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    await recordAuditFailure(
      new ConfigError("bad config"),
      "0.1.0",
      Source.Cli,
    );

    const [, eventCall] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const event = JSON.parse(eventCall[1].body);
    expect(event.ErrorCode).toBe("CONFIG_ERROR");
    expect(event.Result).toBe("failure");
  });

  it("caches the OAuth token across calls in the same process", async () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "fake-api-key";
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    await recordAuditSuccess(report, Source.Cli);
    await recordAuditSuccess(report, Source.Cli);

    const tokenCalls = (
      global.fetch as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call) => call[0].toString().includes("example.org"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("respects the product-specific opt-out env var", async () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "fake-api-key";
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    process.env[ENV_KEYLENS_TELEMETRY_OFF] = "1";
    await recordAuditSuccess(report, Source.Cli);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(machineIdMock.fn).not.toHaveBeenCalled();
  });

  it("respects the shared org-wide opt-out env var", async () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "fake-api-key";
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    process.env[ENV_TELERIK_TELEMETRY_OFF] = "true";
    await recordAuditSuccess(report, Source.Cli);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("respects a per-call enabled: false override (programmatic callers)", async () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "fake-api-key";
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    await recordAuditSuccess(report, Source.Cli, false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("never throws even when the network call fails", async () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "fake-api-key";
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(
      recordAuditSuccess(report, Source.Cli),
    ).resolves.toBeUndefined();
  });
});

describe("toCallHomeSource", () => {
  it("maps every public surface value to its Call-Home Source", () => {
    expect(toCallHomeSource("cli")).toBe(Source.Cli);
    expect(toCallHomeSource("mcp")).toBe(Source.Mcp);
    expect(toCallHomeSource("library")).toBe(Source.Library);
  });
});
