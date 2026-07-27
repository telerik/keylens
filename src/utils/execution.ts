import type { AuditPhase } from "../types/index.js";
import {
  AuditAbortedError,
  AuditTimeoutError,
  KeylensError,
} from "../errors.js";

interface ExecutionScopeOptions {
  parentSignal?: AbortSignal;
  timeout?: number;
  phase: AuditPhase;
  url?: string;
  timeoutKind?: "total" | "phase";
}

export interface ExecutionScope {
  signal: AbortSignal;
  dispose(): void;
}

export function createExecutionScope(
  options: ExecutionScopeOptions,
): ExecutionScope {
  const controller = new AbortController();
  const { parentSignal, timeout, phase, url, timeoutKind = "phase" } = options;

  const abortFromParent = () => {
    controller.abort(
      getAbortError(parentSignal, phase, url, { timeoutKind: "total" }),
    );
  };

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timer =
    timeout !== undefined
      ? setTimeout(() => {
          controller.abort(
            new AuditTimeoutError(phase, timeout, url, { timeoutKind }),
          );
        }, timeout)
      : undefined;

  return {
    signal: controller.signal,
    dispose() {
      if (timer) clearTimeout(timer);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

export function getAbortError(
  signal: AbortSignal | undefined,
  phase: AuditPhase,
  url?: string,
  details?: Readonly<Record<string, unknown>>,
): KeylensError {
  if (signal?.reason instanceof KeylensError) {
    if (
      signal.reason.code === "TIMEOUT" &&
      signal.reason.details?.timeoutKind === "total" &&
      signal.reason.phase !== phase
    ) {
      return new AuditTimeoutError(
        phase,
        Number(signal.reason.details.timeoutMs),
        url,
        signal.reason.details,
      );
    }
    if (signal.reason.code === "ABORTED" && signal.reason.phase !== phase) {
      return new AuditAbortedError(phase, url, {
        cause: signal.reason,
        details,
      });
    }
    return signal.reason;
  }
  return new AuditAbortedError(phase, url, {
    cause: signal?.reason,
    details,
  });
}

export function throwIfAborted(
  signal: AbortSignal | undefined,
  phase: AuditPhase,
  url?: string,
): void {
  if (signal?.aborted) {
    throw getAbortError(signal, phase, url);
  }
}

export async function raceWithSignal<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
  phase: AuditPhase,
  url?: string,
): Promise<T> {
  throwIfAborted(signal, phase, url);
  if (!signal) return operation;

  let abortHandler: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abortHandler = () => reject(getAbortError(signal, phase, url));
    signal.addEventListener("abort", abortHandler, { once: true });
  });

  try {
    return await Promise.race([operation, aborted]);
  } finally {
    if (abortHandler) signal.removeEventListener("abort", abortHandler);
  }
}
