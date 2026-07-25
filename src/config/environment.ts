import { z } from 'zod';

const environmentSchema = z.object({
  ML_SERVICE_BASE_URL: z.string().url(),
  ML_SERVICE_API_KEY: z.string().min(1),
  ML_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
});

export interface MlServiceConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

const analysisPlanEnvironmentSchema = z.object({
  ANALYSIS_PLAN_TOKEN_SECRET: z.string().min(32),
});

export interface AnalysisPlanConfig {
  tokenSecret: string;
  tokenLifetimeMs: number;
}

export function loadMlServiceConfig(environment: NodeJS.ProcessEnv = process.env): MlServiceConfig {
  const parsed = environmentSchema.parse(environment);
  const url = new URL(parsed.ML_SERVICE_BASE_URL);
  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('ML_SERVICE_BASE_URL must use HTTPS outside local development.');
  }

  return {
    baseUrl: url.toString().replace(/\/$/, ''),
    apiKey: parsed.ML_SERVICE_API_KEY,
    timeoutMs: parsed.ML_SERVICE_TIMEOUT_MS,
  };
}

export function loadAnalysisPlanConfig(environment: NodeJS.ProcessEnv = process.env): AnalysisPlanConfig {
  const parsed = analysisPlanEnvironmentSchema.parse(environment);

  return {
    tokenSecret: parsed.ANALYSIS_PLAN_TOKEN_SECRET,
    tokenLifetimeMs: 15 * 60 * 1000,
  };
}
