export type MetricsDimensions = Record<string, unknown> | null | undefined;
/**
 * Compute a stable hash for a dimensions object so we can enforce uniqueness
 * across (metricKey, date, granularity, dimensions).
 */
export declare function computeDimensionsHash(dimensions: MetricsDimensions): string;
//# sourceMappingURL=dimensions.d.ts.map