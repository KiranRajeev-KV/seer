import assert from 'node:assert/strict';
import test from 'node:test';
import { DatasetNotFoundError, DatasetsService } from './datasets.service.js';

test('lists the packaged datasets without exposing their file paths', async () => {
  const datasets = new DatasetsService();
  const catalogue = await datasets.list();

  assert.deepEqual(catalogue, [{
    id: 'employee-compensation',
    name: 'Employee Compensation',
    description: 'Synthetic employee compensation data with numeric and categorical features.',
    taskHints: ['regression'],
    rows: 1500,
    columns: 9,
  }, {
    id: 'employee-attrition',
    name: 'Employee Attrition',
    description: 'Synthetic employee attrition data with numeric and categorical workplace features.',
    taskHints: ['classification'],
    rows: 60,
    columns: 6,
  }]);
});

test('reads the compiled CSV asset', async () => {
  const datasets = new DatasetsService();
  const csv = await datasets.readCsvText('employee-compensation');

  assert.match(csv, /^employee_id,years_experience,education_level,/);
  assert.equal(csv.trim().split('\n').length, 1501);
});

test('reads the compiled employee attrition CSV asset', async () => {
  const datasets = new DatasetsService();
  const csv = await datasets.readCsvText('employee-attrition');

  assert.match(csv, /^tenure_years,monthly_hours,performance_rating,department,work_arrangement,attrition/);
  assert.equal(csv.trim().split('\n').length, 61);
});

test('rejects non-allowlisted dataset IDs', async () => {
  const datasets = new DatasetsService();

  await assert.rejects(datasets.readCsv('not-a-dataset'), DatasetNotFoundError);
});
