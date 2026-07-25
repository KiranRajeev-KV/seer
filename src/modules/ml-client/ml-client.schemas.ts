import { z } from 'zod';

export const mlServiceHealthSchema = z.object({
  status: z.literal('healthy'),
  service: z.literal('seer-ml'),
  version: z.string().min(1),
});

export type MlServiceHealth = z.infer<typeof mlServiceHealthSchema>;
