import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetCallHomeClientForTests,
  getConfiguredApiKey,
  postCallHomeEvent,
} from "@/telemetry/call-home-client.js";

const ENV_KEYLENS_TELEMETRY_API_KEY = "KEYLENS_TELEMETRY_IDENTITY_API_KEY";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

describe("call-home-client", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env[ENV_KEYLENS_TELEMETRY_API_KEY];
    _resetCallHomeClientForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
    _resetCallHomeClientForTests();
  });

  it("returns undefined when no key is configured anywhere (never a hardcoded fallback)", () => {
    expect(getConfiguredApiKey()).toBeUndefined();
  });

  it("uses the env var override when set", () => {
    process.env[ENV_KEYLENS_TELEMETRY_API_KEY] = "local-test-key";
    expect(getConfiguredApiKey()).toBe("local-test-key");
  });

  it("throws when no token URL/endpoint is configured anywhere (never a hardcoded fallback)", async () => {
    await expect(
      postCallHomeEvent({ Type: "KeylensUsed" }, "test-key"),
    ).rejects.toThrow(/Call-Home endpoint is not configured/);
  });

  it("fetches a token then posts the event, and surfaces non-ok responses as errors", async () => {
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init });
      if (calls.length === 1) {
        return new Response(
          JSON.stringify({
            access_token: "tok",
            token_type: "Bearer",
            expires_in: 60,
          }),
          { status: 200 },
        );
      }
      return new Response("nope", { status: 500 });
    }) as unknown as typeof fetch;

    await expect(
      postCallHomeEvent({ Type: "KeylensUsed" }, "test-key"),
    ).rejects.toThrow(/Call-Home event upload failed \(500\)/);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toContain("example.org");
    expect(
      (calls[0]!.init?.headers as Record<string, string>).Authorization,
    ).toBe("Basic test-key");
    expect(calls[1]!.url).toContain("/events/callhome");
    expect(
      (calls[1]!.init?.headers as Record<string, string>).Authorization,
    ).toBe("Bearer tok");
  });

  it("throws when the token request itself fails", async () => {
    process.env.KEYLENS_TELEMETRY_TOKEN_URL = "https://example.org/token";
    process.env.KEYLENS_TELEMETRY_ENDPOINT = "https://example.net/collect";
    global.fetch = vi.fn(
      async () => new Response("unauthorized", { status: 401 }),
    ) as unknown as typeof fetch;

    await expect(
      postCallHomeEvent({ Type: "KeylensUsed" }, "bad-key"),
    ).rejects.toThrow(/Telerik Identity token request failed \(401\)/);
  });
});
