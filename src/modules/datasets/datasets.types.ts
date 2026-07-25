import { z } from 'zod';

export const datasetDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  taskHints: z.array(z.enum(['regression', 'classification'])).min(1),
  rows: z.number().int().positive(),
  columns: z.number().int().positive(),
  fileName: z.string().regex(/^[a-z0-9-]+\.csv$/),
});

export const datasetCatalogSchema = z.object({
  datasets: z.array(datasetDefinitionSchema).min(1),
});

export type DatasetDefinition = z.infer<typeof datasetDefinitionSchema>;
export type DatasetCatalog = z.infer<typeof datasetCatalogSchema>;
export type PublicDatasetDefinition = Omit<DatasetDefinition, 'fileName'>;
