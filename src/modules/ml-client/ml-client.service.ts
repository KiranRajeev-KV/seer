import { Injectable } from '@nitrostack/core';
import { loadMlServiceConfig, type MlServiceConfig } from '../../config/environment.js';
import { mlServiceHealthSchema, type MlServiceHealth } from './ml-client.schemas.js';

interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchImplementation = (
  input: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<HttpResponse>;

export class MlServiceError extends Error {
  constructor(
    public readonly code: 'timeout' | 'unavailable' | 'upstream_error' | 'invalid_response',
    message: string,
  ) {
    super(message);
    this.name = 'MlServiceError';
  }
}

const defaultFetch: FetchImplementation = (input, init) => fetch(input, init);

@Injectable({ deps: [] })
export class MlClientService {
  constructor(
    private readonly config: MlServiceConfig = loadMlServiceConfig(),
    private readonly fetchImplementation: FetchImplementation = defaultFetch,
  ) {}

  async health(): Promise<MlServiceHealth> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImplementation(`${this.config.baseUrl}/health`, {
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new MlServiceError('upstream_error', `ML service health check failed with status ${response.status}.`);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new MlServiceError('invalid_response', 'ML service returned an invalid health response.');
      }

      const parsed = mlServiceHealthSchema.safeParse(payload);
      if (!parsed.success) {
        throw new MlServiceError('invalid_response', 'ML service returned an invalid health response.');
      }

      return parsed.data;
    } catch (error) {
      if (error instanceof MlServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new MlServiceError('timeout', 'ML service health check timed out.');
      }

      throw new MlServiceError('unavailable', 'ML service is unavailable.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
