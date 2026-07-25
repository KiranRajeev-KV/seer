import { Injectable } from '@nitrostack/core';
import { loadMlServiceConfig, type MlServiceConfig } from '../../config/environment.js';
import {
  mlServiceHealthSchema,
  mlServiceProfileSchema,
  type MlServiceHealth,
  type MlServiceProfile,
} from './ml-client.schemas.js';

interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchImplementation = (
  input: string,
  init: { headers: Record<string, string>; signal: AbortSignal; method?: string; body?: FormData },
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
  private config: MlServiceConfig;
  private fetchImplementation: FetchImplementation;

  constructor() {
    this.config = loadMlServiceConfig();
    this.fetchImplementation = defaultFetch;
  }

  static forTesting(config: MlServiceConfig, fetchImplementation: FetchImplementation = defaultFetch): MlClientService {
    const service = Object.create(MlClientService.prototype) as MlClientService;
    service.config = config;
    service.fetchImplementation = fetchImplementation;
    return service;
  }

  async health(): Promise<MlServiceHealth> {
    const response = await this.request('/health');

    if (!response.ok) {
      throw new MlServiceError('upstream_error', `ML service health check failed with status ${response.status}.`);
    }

    const payload = await this.readJson(response, 'health');
    const parsed = mlServiceHealthSchema.safeParse(payload);
    if (!parsed.success) {
      throw new MlServiceError('invalid_response', 'ML service returned an invalid health response.');
    }

    return parsed.data;
  }

  async profile(datasetId: string, csv: Buffer): Promise<MlServiceProfile> {
    const body = new FormData();
    body.set('dataset_id', datasetId);
    body.set('file', new Blob([csv], { type: 'text/csv' }), `${datasetId}.csv`);

    const response = await this.request('/v1/profile', {
      method: 'POST',
      body,
    });

    if (!response.ok) {
      throw new MlServiceError('upstream_error', `ML service profiling failed with status ${response.status}.`);
    }

    const payload = await this.readJson(response, 'profile');
    const parsed = mlServiceProfileSchema.safeParse(payload);
    if (!parsed.success) {
      throw new MlServiceError('invalid_response', 'ML service returned an invalid profile response.');
    }

    return parsed.data;
  }

  private async request(path: string, request: { method?: string; body?: FormData } = {}): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      return await this.fetchImplementation(`${this.config.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
        ...request,
      });
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

  private async readJson(response: HttpResponse, operation: 'health' | 'profile'): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new MlServiceError('invalid_response', `ML service returned an invalid ${operation} response.`);
    }
  }
}
