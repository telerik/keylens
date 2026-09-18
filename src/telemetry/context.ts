/**
 * Central telemetry entry point. Resolves the machine id and posts one
 * Call-Home event per audit run, honoring opt-out env vars and showing
 * the one-time notice before the very first collected event.
 *
 * Telemetry is inert by default: with no Telerik Identity API key
 * configured (see call-home-client.ts), nothing is resolved, shown, or
 * collected — a normal local `npm run build`/`npm test` never talks to
 * the network.
 */

import type { AuditReport } from "../types/index.js";
import {
  ENV_KEYLENS_TELEMETRY_OFF,
  ENV_TELERIK_TELEMETRY_OFF,
  Source,
} from "./constants.js";
import { ensureNoticeShown } from "./notice.js";
import { getConfiguredApiKey, postCallHomeEvent } from "./call-home-client.js";
import { buildFailureEvent, buildSuccessEvent } from "./event.js";
import type { CallHomeEvent } from "./event.js";
import type { SourceValue } from "./constants.js";

// Set by Telerik developers validating the pipeline so their own runs are
// excluded from real usage aggregates.
const ENV_INTERNAL = "KEYLENS_TELEMETRY_INTERNAL";

/**
 * Maps the public, CLI/library-facing AuditOptions.telemetrySurface value
 * ("cli" | "mcp" | "library") onto the internal telemetry `Source` enum.
 */
export function toCallHomeSource(
  surface: "cli" | "mcp" | "library",
): SourceValue {
  switch (surface) {
    case "cli":
      return Source.Cli;
    case "mcp":
      return Source.Mcp;
    case "library":
      return Source.Library;
  }
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true";
}

function isOptedOut(): boolean {
  return (
    isTruthyEnv(process.env[ENV_TELERIK_TELEMETRY_OFF]) ||
    isTruthyEnv(process.env[ENV_KEYLENS_TELEMETRY_OFF])
  );
}

/**
 * Shared send path: resolves the machine id, builds the event, shows the
 * one-time notice, and posts to Call-Home. Never throws — a telemetry
 * failure must never break a CLI, MCP, or library audit.
 */
async function send(
  surface: SourceValue,
  enabled: boolean | undefined,
  buildEvent: (envelope: {
    source: SourceValue;
    machineId: string;
    isInternalUsage: boolean;
  }) => CallHomeEvent,
): Promise<void> {
  if (enabled === false || isOptedOut()) {
    return;
  }

  // No API key configured at all — stay fully dormant, don't even resolve
  // the machine id or show the notice (nothing is actually collected).
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    return;
  }

  try {
    // @telerik/machine-id is an optionalDependency (see package.json) so
    // that npm install never fails for consumers who can't reach its
    // registry — imported dynamically so a missing/failed install only
    // disables telemetry (caught below), instead of crashing this module
    // for every caller. loadMachineId() caches internally, so this only
    // resolves once per process regardless of how many events are sent.
    const { default: loadMachineId } = await import("@telerik/machine-id");
    const { id: machineId } = await loadMachineId();
    const event = buildEvent({
      source: surface,
      machineId,
      isInternalUsage: isTruthyEnv(process.env[ENV_INTERNAL]),
    });

    // The notice must be shown before the first collected event — do this
    // only once we know we're about to collect.
    ensureNoticeShown();

    await postCallHomeEvent(event, apiKey);
  } catch {
    // never let telemetry break a caller
  }
}

/** Records a KeylensUsed event for a completed audit. Never throws. */
export function recordAuditSuccess(
  report: AuditReport,
  surface: SourceValue,
  enabled?: boolean,
): Promise<void> {
  return send(surface, enabled, (envelope) =>
    buildSuccessEvent(report, envelope),
  );
}

/** Records a KeylensUsed event for an audit that threw. Never throws. */
export function recordAuditFailure(
  error: unknown,
  version: string,
  surface: SourceValue,
  enabled?: boolean,
): Promise<void> {
  return send(surface, enabled, (envelope) =>
    buildFailureEvent(version, error, envelope),
  );
}
