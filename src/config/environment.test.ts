import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMlServiceConfig } from './environment.js';

test('loads a valid HTTPS ML-service configuration', () => {
  const config = loadMlServiceConfig({
    ML_SERVICE_BASE_URL: 'https://seer-ml.example.com/',
    ML_SERVICE_API_KEY: 'test-secret',
  });

  assert.deepEqual(config, {
    baseUrl: 'https://seer-ml.example.com',
    apiKey: 'test-secret',
    timeoutMs: 10_000,
  });
});

test('allows HTTP only for localhost development', () => {
  const config = loadMlServiceConfig({
    ML_SERVICE_BASE_URL: 'http://127.0.0.1:8080',
    ML_SERVICE_API_KEY: 'test-secret',
  });

  assert.equal(config.baseUrl, 'http://127.0.0.1:8080');
});

test('rejects non-local HTTP ML-service URLs', () => {
  assert.throws(
    () => loadMlServiceConfig({
      ML_SERVICE_BASE_URL: 'http://seer-ml.example.com',
      ML_SERVICE_API_KEY: 'test-secret',
    }),
    /HTTPS/,
  );
});
