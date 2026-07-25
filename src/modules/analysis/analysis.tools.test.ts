import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionContext } from '@nitrostack/core';
import { AnalysisTools } from './analysis.tools.js';

const plan = {
  datasetId: 'employee-compensation', question: 'Estimate salary', targetColumn: 'annual_salary', featureColumns: ['years_experience'], taskType: 'regression' as const, predictionRows: [{ years_experience: 10 }],
  preprocessing: { numeric: ['years_experience'], categorical: [], numericImputer: 'median' as const, numericScaler: 'standard' as const, categoricalImputer: 'most_frequent' as const, categoricalEncoder: 'one_hot' as const },
  rows: { dataset: 30, missingTarget: 0, usable: 30 }, excludedColumns: [], assumptions: [], warnings: [], split: { trainingPercent: 80 as const, testPercent: 20 as const, randomState: 42 as const },
};

test('creates, confirms, and executes plans through thin MCP tool interfaces', async () => {
  const calls: string[] = [];
  const analysis = {
    create: async () => ({ plan, planToken: 'token', expiresAt: '2026-01-01T00:15:00.000Z' }),
    confirm: async () => ({ approved: true as const, plan, expiresAt: '2026-01-01T00:15:00.000Z' }),
    prepareRun: async () => ({ plan, csv: Buffer.from('years_experience,annual_salary\n10,100000\n'), expiresAt: '2026-01-01T00:15:00.000Z' }),
  };
  const mlClient = {
    analyze: async () => ({
      analysisId: '00000000-0000-4000-8000-000000000001', taskType: 'regression' as const,
      model: { name: 'LinearRegression' as const }, baseline: { name: 'DummyRegressor (mean)' as const }, quality: 'useful_signal' as const,
      metrics: { model: { mae: 1, rmse: 1, r2: 0.9 }, baseline: { mae: 2, rmse: 2, r2: 0 }, improvement: { maeAbsolute: 1, maePercent: 50, rmseAbsolute: 1, rmsePercent: 50, r2Absolute: 0.9 } },
      predictions: [{ input: { years_experience: 10 }, estimatedValue: 100000, coverage: { outsideNumericRanges: [], unseenCategoricalValues: [] } }],
      charts: { actualVsPredicted: [{ actual: 100000, predicted: 100000 }], residualVsPredicted: [{ predicted: 100000, residual: 0 }] },
      datasetCoverage: { trainingRows: 24, testRows: 6, numericRanges: { years_experience: { min: 1, max: 20 } }, categoricalValues: {} },
      warnings: [], explanationFacts: { targetColumn: 'annual_salary', usableRows: 30, droppedMissingTargetRows: 0 },
    }),
  };
  const tools = new AnalysisTools(analysis as never, mlClient as never);
  const context = {
    requestId: 'test-request', logger: { info: (message: string) => calls.push(message), error: () => undefined },
  } as unknown as ExecutionContext;

  const created = await tools.createAnalysisPlan({
    datasetId: 'employee-compensation', question: 'Estimate salary', targetColumn: 'annual_salary',
    featureColumns: ['years_experience'], taskType: 'regression', predictionRows: [{ years_experience: 10 }],
  }, context);
  const confirmed = await tools.confirmAnalysisPlan({ planToken: created.planToken }, context);
  const result = await tools.runAnalysis({ planToken: created.planToken }, context);

  assert.equal(confirmed.approved, true);
  assert.equal(result.targetColumn, 'annual_salary');
  assert.deepEqual(calls, ['Analysis plan created', 'Analysis plan confirmed', 'Regression analysis completed']);
});
