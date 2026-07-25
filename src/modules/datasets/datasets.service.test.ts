import assert from 'node:assert/strict';
import test from 'node:test';
import { DatasetNotFoundError, DatasetsService } from './datasets.service.js';

test('lists the packaged employee-compensation dataset without exposing its file path', async () => {
  const datasets = new DatasetsService();
  const catalogue = await datasets.list();

  assert.deepEqual(catalogue, [{
    id: 'employee-compensation',
    name: 'Employee Compensation',
    description: 'Synthetic employee compensation data with numeric and categorical features.',
    taskHints: ['regression'],
    rows: 1500,
    columns: 9,
  }]);
});

test('reads the compiled CSV asset', async () => {
  const datasets = new DatasetsService();
  const csv = await datasets.readCsvText('employee-compensation');

  assert.match(csv, /^employee_id,years_experience,education_level,/);
  assert.equal(csv.trim().split('\n').length, 1501);
});

test('rejects non-allowlisted dataset IDs', async () => {
  const datasets = new DatasetsService();

  await assert.rejects(datasets.readCsv('not-a-dataset'), DatasetNotFoundError);
});
