/**
 * Minimal Call-Home REST client — a plain `fetch`-based OAuth2
 * client-credentials exchange plus a single event POST.
 *
 * Deliberately a small, self-contained client rather than pulling in a
 * larger generated SDK: Keylens only ever sends one event shape.
 *
 * The Telerik Identity API key, token URL, and Call-Home endpoint are
 * never hardcoded — they're injected at publish time via tsup's `define`
 * (see tsup.config.ts, mirroring the existing `__VERSION__` pattern), or
 * supplied locally via env vars for testing. With no key configured,
 * `getConfiguredApiKey()` returns undefined and callers must stay
 * dormant — this file never falls back to a literal key.
 */

import type { CallHomeEvent } from "./event.js";

declare const __TELEMETRY_API_KEY__: string | undefined;
declare const __TELEMETRY_TOKEN_URL__: string | undefined;
declare const __TELEMETRY_ENDPOINT__: string | undefined;

// Same rule as the API key: no literal fallback in this file, resolved
// lazily on each call (not a module-level const) so env var overrides set
// in tests take effect. Configure via env var (local testing) or the
// build-time `define` (see tsup.config.ts); if neither is set, callers get
// undefined and fail fast rather than silently using a baked-in URL.
function getConfiguredTokenUrl(): string | undefined {
  const override = process.env.KEYLENS_TELEMETRY_TOKEN_URL;
  if (override) return override;
  return typeof __TELEMETRY_TOKEN_URL__ !== "undefined" &&
    __TELEMETRY_TOKEN_URL__
    ? __TELEMETRY_TOKEN_URL__
    : undefined;
}
function getConfiguredEndpoint(): string | undefined {
  const override = process.env.KEYLENS_TELEMETRY_ENDPOINT;
  if (override) return override;
  return typeof __TELEMETRY_ENDPOINT__ !== "undefined" && __TELEMETRY_ENDPOINT__
    ? __TELEMETRY_ENDPOINT__
    : undefined;
}

/** Wall-clock budget for each of the token fetch and event POST — telemetry must never meaningfully delay an audit. */
const REQUEST_TIMEOUT_MS = 1500;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: string | undefined;
let cachedTokenExpiresAt = 0;

/** Test-only: forget the cached token so a new key/env takes effect. */
export function _resetCallHomeClientForTests(): void {
  cachedToken = undefined;
  cachedTokenExpiresAt = 0;
}

/**
 * Resolves the Telerik Identity API key: an explicit env var override first
 * (local testing), then the build-time injected constant. Never a literal
 * string in this source file.
 */
export function getConfiguredApiKey(): string | undefined {
  const override = process.env.KEYLENS_TELEMETRY_IDENTITY_API_KEY;
  if (override) return override;
  return typeof __TELEMETRY_API_KEY__ !== "undefined" && __TELEMETRY_API_KEY__
    ? __TELEMETRY_API_KEY__
    : undefined;
}

async function getAccessToken(apiKey: string): Promise<string> {
  if (cachedToken && Date.now() <= cachedTokenExpiresAt) {
    return cachedToken;
  }
  const tokenUrl = getConfiguredTokenUrl();
  if (!tokenUrl) {
    throw new Error("Call-Home token URL is not configured");
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Telerik Identity token request failed (${response.status})`,
    );
  }

  const token = (await response.json()) as TokenResponse;
  cachedToken = token.access_token;
  cachedTokenExpiresAt = Date.now() + token.expires_in * 1_000;
  return cachedToken;
}

/**
 * Posts one Call-Home event. Throws on any failure — callers (context.ts)
 * are responsible for the "never break/block an audit" guarantee via a
 * timeout + swallow-all-errors wrapper.
 */
export async function postCallHomeEvent(
  event: CallHomeEvent,
  apiKey: string,
): Promise<void> {
  const endpoint = getConfiguredEndpoint();
  if (!endpoint) {
    throw new Error("Call-Home endpoint is not configured");
  }
  const accessToken = await getAccessToken(apiKey);

  const response = await fetch(`${endpoint}/events/callhome`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Call-Home event upload failed (${response.status})`);
  }
}
