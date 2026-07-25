import assert from 'node:assert/strict';
import test from 'node:test';
import type { MlServiceConfig } from '../../config/environment.js';
import { MlClientService, MlServiceError, type FetchImplementation } from './ml-client.service.js';

const config: MlServiceConfig = {
  baseUrl: 'https://seer-ml.example.com',
  apiKey: 'test-secret',
  timeoutMs: 25,
};

function makeClient(fetchImplementation: FetchImplementation): MlClientService {
  return new MlClientService(config, fetchImplementation);
}

test('returns a valid ML-service health response', async () => {
  let requestUrl = '';
  let authorization = '';
  const client = makeClient(async (input, init) => {
    requestUrl = input;
    authorization = init.headers.authorization;
    return new Response(JSON.stringify({ status: 'healthy', service: 'seer-ml', version: '0.1.0' }), { status: 200 });
  });

  const result = await client.health();

  assert.equal(requestUrl, 'https://seer-ml.example.com/health');
  assert.equal(authorization, 'Bearer test-secret');
  assert.deepEqual(result, { status: 'healthy', service: 'seer-ml', version: '0.1.0' });
});

test('normalizes timeouts', async () => {
  const client = makeClient(async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });

  await assert.rejects(client.health(), (error: unknown) => error instanceof MlServiceError && error.code === 'timeout');
});

test('normalizes upstream HTTP errors without exposing a response body', async () => {
  const client = makeClient(async () => new Response('sensitive details', { status: 503 }));

  await assert.rejects(client.health(), (error: unknown) => error instanceof MlServiceError
    && error.code === 'upstream_error'
    && error.message === 'ML service health check failed with status 503.');
});

test('rejects malformed health responses', async () => {
  const client = makeClient(async () => new Response(JSON.stringify({ status: 'up' }), { status: 200 }));

  await assert.rejects(client.health(), (error: unknown) => error instanceof MlServiceError && error.code === 'invalid_response');
});
