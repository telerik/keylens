export interface BenchmarkBudget {
  wallTimeMs: number;
  rssDeltaBytes: number;
  compactSerializedBytes: number;
  inlineScreenshotBytes?: number;
}

const MIB = 1024 * 1024;

/**
 * Conservative CI regression ceilings. Product-level limits remain enforced by
 * configuration; these budgets catch accidental order-of-magnitude regressions.
 */
export const BENCHMARK_BUDGETS: Record<string, BenchmarkBudget> = {
  standard: {
    wallTimeMs: 15_000,
    rssDeltaBytes: 256 * MIB,
    compactSerializedBytes: 12 * 1024 * 1024,
  },
  interactions: {
    wallTimeMs: 30_000,
    rssDeltaBytes: 256 * MIB,
    compactSerializedBytes: 4 * 1024 * 1024,
  },
};
