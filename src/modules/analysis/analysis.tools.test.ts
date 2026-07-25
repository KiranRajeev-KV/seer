import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionContext } from '@nitrostack/core';
import { AnalysisTools } from './analysis.tools.js';

test('creates and confirms plans through thin MCP tool interfaces', async () => {
  const calls: string[] = [];
  const tools = new AnalysisTools({
    create: async () => ({
      plan: {
        datasetId: 'employee-compensation', question: 'Estimate salary', targetColumn: 'annual_salary', featureColumns: ['years_experience'], taskType: 'regression' as const, predictionRows: [{ years_experience: 10 }],
        preprocessing: { numeric: ['years_experience'], categorical: [], numericImputer: 'median' as const, numericScaler: 'standard' as const, categoricalImputer: 'most_frequent' as const, categoricalEncoder: 'one_hot' as const },
        rows: { dataset: 30, missingTarget: 0, usable: 30 }, excludedColumns: [], assumptions: [], warnings: [], split: { trainingPercent: 80 as const, testPercent: 20 as const, randomState: 42 as const },
      }, planToken: 'token', expiresAt: '2026-01-01T00:15:00.000Z',
    }),
    confirm: async () => ({
      approved: true as const,
      plan: {
        datasetId: 'employee-compensation', question: 'Estimate salary', targetColumn: 'annual_salary', featureColumns: ['years_experience'], taskType: 'regression' as const, predictionRows: [{ years_experience: 10 }],
        preprocessing: { numeric: ['years_experience'], categorical: [], numericImputer: 'median' as const, numericScaler: 'standard' as const, categoricalImputer: 'most_frequent' as const, categoricalEncoder: 'one_hot' as const },
        rows: { dataset: 30, missingTarget: 0, usable: 30 }, excludedColumns: [], assumptions: [], warnings: [], split: { trainingPercent: 80 as const, testPercent: 20 as const, randomState: 42 as const },
      }, expiresAt: '2026-01-01T00:15:00.000Z',
    }),
  } as never);
  const context = {
    requestId: 'test-request', logger: { info: (message: string) => calls.push(message), error: () => undefined },
  } as unknown as ExecutionContext;

  const created = await tools.createAnalysisPlan({
    datasetId: 'employee-compensation', question: 'Estimate salary', targetColumn: 'annual_salary',
    featureColumns: ['years_experience'], taskType: 'regression', predictionRows: [{ years_experience: 10 }],
  }, context);
  const confirmed = await tools.confirmAnalysisPlan({ planToken: created.planToken }, context);

  assert.equal(confirmed.approved, true);
  assert.deepEqual(calls, ['Analysis plan created', 'Analysis plan confirmed']);
});
