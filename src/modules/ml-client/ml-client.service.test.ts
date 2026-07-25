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
  return MlClientService.forTesting(config, fetchImplementation);
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

test('sends an authenticated multipart profile request', async () => {
  let requestUrl = '';
  let method = '';
  let form: FormData | undefined;
  const client = makeClient(async (input, init) => {
    requestUrl = input;
    method = init.method ?? '';
    form = init.body;
    return new Response(JSON.stringify({
      datasetId: 'employee-compensation',
      dimensions: { rows: 2, columns: 2 },
      columns: [
        {
          name: 'annual_salary', type: 'numeric', missingCount: 0, missingPercent: 0, uniqueCount: 2,
          numericSummary: { min: 80000, max: 90000, mean: 85000, median: 85000, standardDeviation: 5000, q1: 82500, q3: 87500 },
          categories: [],
        },
      ],
      duplicateRowCount: 0,
      targetCandidates: ['annual_salary'],
      identifierCandidates: [],
      constantColumns: [],
      unsupportedColumns: [],
      sampleRows: [{ annual_salary: 80000 }],
      warnings: [],
      charts: { missingValues: [{ column: 'annual_salary', count: 0 }], numericDistributions: [], categoryFrequencies: [] },
    }), { status: 200 });
  });

  const profile = await client.profile('employee-compensation', Buffer.from('annual_salary\n80000\n90000\n'));

  assert.equal(requestUrl, 'https://seer-ml.example.com/v1/profile');
  assert.equal(method, 'POST');
  assert.ok(form);
  assert.equal(form.get('dataset_id'), 'employee-compensation');
  assert.equal(await (form.get('file') as Blob).text(), 'annual_salary\n80000\n90000\n');
  assert.deepEqual(profile.dimensions, { rows: 2, columns: 2 });
});

test('rejects malformed profile responses', async () => {
  const client = makeClient(async () => new Response(JSON.stringify({ datasetId: 'employee-compensation' }), { status: 200 }));

  await assert.rejects(client.profile('employee-compensation', Buffer.from('a\n1\n')),
    (error: unknown) => error instanceof MlServiceError && error.code === 'invalid_response');
});
