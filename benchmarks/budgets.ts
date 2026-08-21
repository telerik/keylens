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
    compactSerializedBytes: 512 * 1024,
  },
  "element-screenshots": {
    wallTimeMs: 30_000,
    rssDeltaBytes: 512 * MIB,
    compactSerializedBytes: 512 * 1024,
    inlineScreenshotBytes: 50 * MIB,
  },
  interactions: {
    wallTimeMs: 30_000,
    rssDeltaBytes: 256 * MIB,
    compactSerializedBytes: 1024 * 1024,
  },
};
