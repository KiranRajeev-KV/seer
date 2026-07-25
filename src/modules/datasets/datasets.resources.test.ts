import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionContext } from '@nitrostack/core';
import { DatasetsResources } from './datasets.resources.js';
import { DatasetsService } from './datasets.service.js';

const context = {} as ExecutionContext;

test('serves the public dataset catalogue as a resource payload', async () => {
  const resources = new DatasetsResources(new DatasetsService());

  const result = await resources.getCatalogue('seer://datasets', context);

  assert.equal(result.datasets[0]?.id, 'employee-compensation');
  assert.equal('fileName' in result.datasets[0]!, false);
});

test('serves the employee compensation resource as CSV text', async () => {
  const resources = new DatasetsResources(new DatasetsService());

  const result = await resources.getEmployeeCompensationCsv('seer://datasets/employee-compensation', context);

  assert.match(result, /^employee_id,years_experience,education_level,/);
});
