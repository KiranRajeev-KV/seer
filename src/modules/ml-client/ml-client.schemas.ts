import { z } from 'zod';

export const mlServiceHealthSchema = z.object({
  status: z.literal('healthy'),
  service: z.literal('seer-ml'),
  version: z.string().min(1),
});

export type MlServiceHealth = z.infer<typeof mlServiceHealthSchema>;

const profileScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const numericSummarySchema = z.object({
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  median: z.number(),
  standardDeviation: z.number(),
  q1: z.number(),
  q3: z.number(),
});

const categoryFrequencySchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});

const histogramBinSchema = z.object({
  start: z.number(),
  end: z.number(),
  count: z.number().int().nonnegative(),
});

export const mlServiceProfileSchema = z.object({
  datasetId: z.string().min(1),
  dimensions: z.object({
    rows: z.number().int().positive(),
    columns: z.number().int().positive(),
  }),
  columns: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['boolean', 'numeric', 'categorical', 'datetime', 'text', 'empty']),
    missingCount: z.number().int().nonnegative(),
    missingPercent: z.number().min(0).max(100),
    uniqueCount: z.number().int().nonnegative(),
    numericSummary: numericSummarySchema.nullable(),
    categories: z.array(categoryFrequencySchema),
  })).min(1),
  duplicateRowCount: z.number().int().nonnegative(),
  targetCandidates: z.array(z.string()),
  identifierCandidates: z.array(z.string()),
  constantColumns: z.array(z.string()),
  unsupportedColumns: z.array(z.object({
    name: z.string(),
    reason: z.string(),
  })),
  sampleRows: z.array(z.record(profileScalarSchema)).max(10),
  warnings: z.array(z.string()),
  charts: z.object({
    missingValues: z.array(z.object({ column: z.string(), count: z.number().int().nonnegative() })),
    numericDistributions: z.array(z.object({
      column: z.string(),
      bins: z.array(histogramBinSchema),
    })),
    categoryFrequencies: z.array(z.object({
      column: z.string(),
      values: z.array(categoryFrequencySchema),
    })),
  }),
});

export type MlServiceProfile = z.infer<typeof mlServiceProfileSchema>;
