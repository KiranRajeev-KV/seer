import { ExecutionContext, Injectable, ToolDecorator as Tool, Widget, z } from '@nitrostack/core';
import {
  confirmAnalysisPlanInputSchema,
  confirmAnalysisPlanResponseSchema,
  createAnalysisPlanInputSchema,
  createAnalysisPlanResponseSchema,
  runAnalysisInputSchema,
  runAnalysisResponseSchema,
} from './analysis.schemas.js';
import { AnalysisService } from './analysis.service.js';
import { MlClientService, MlServiceError } from '../ml-client/ml-client.service.js';

@Injectable({ deps: [AnalysisService, MlClientService] })
export class AnalysisTools {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly mlClient: MlClientService,
  ) {}

  @Tool({
    name: 'create_analysis_plan',
    description: 'Validate a proposed supervised-learning plan for an approved Seer dataset. Call profile_dataset first, then require user approval before execution.',
    inputSchema: createAnalysisPlanInputSchema,
    outputSchema: createAnalysisPlanResponseSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  })
  @Widget('analysis-plan')
  async createAnalysisPlan(input: z.infer<typeof createAnalysisPlanInputSchema>, context: ExecutionContext) {
    const result = await this.analysis.create(input);
    context.logger.info('Analysis plan created', {
      datasetId: result.plan.datasetId,
      taskType: result.plan.taskType,
      targetColumn: result.plan.targetColumn,
      requestId: context.requestId,
    });
    return result;
  }

  @Tool({
    name: 'confirm_analysis_plan',
    description: 'After the user explicitly approves a Seer plan, exchange its review token for an execution token. This verifies signature, expiration, and dataset hash; it does not train a model.',
    inputSchema: confirmAnalysisPlanInputSchema,
    outputSchema: confirmAnalysisPlanResponseSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  })
  async confirmAnalysisPlan(input: z.infer<typeof confirmAnalysisPlanInputSchema>, context: ExecutionContext) {
    const result = await this.analysis.confirm(input.reviewToken);
    context.logger.info('Analysis plan confirmed', {
      datasetId: result.plan.datasetId,
      taskType: result.plan.taskType,
      requestId: context.requestId,
    });
    return result;
  }

  @Tool({
    name: 'run_analysis',
    description: 'Execute a Seer regression or classification plan only with an execution token returned after explicit user approval. It verifies the signed token and dataset hash, then trains and evaluates through the ML service.',
    inputSchema: runAnalysisInputSchema,
    outputSchema: runAnalysisResponseSchema,
    taskSupport: 'optional',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  })
  @Widget('next-analysis-results')
  async runAnalysis(input: z.infer<typeof runAnalysisInputSchema>, context: ExecutionContext) {
    try {
      context.task?.updateProgress('Validating dataset');
      context.task?.throwIfCancelled();
      const approved = await this.analysis.prepareRun(input.executionToken);
      context.task?.updateProgress('Preparing train and test sets');
      context.task?.throwIfCancelled();
      context.task?.updateProgress('Fitting preprocessing pipeline');
      context.task?.updateProgress('Training model');
      const result = await this.mlClient.analyze(approved.plan, approved.csv, context.requestId);
      context.task?.throwIfCancelled();
      context.task?.updateProgress('Training baseline');
      context.task?.updateProgress('Evaluating models');
      context.task?.updateProgress('Generating predictions');
      context.task?.updateProgress('Preparing visualisations');
      context.logger.info('Analysis completed', {
        datasetId: approved.plan.datasetId,
        taskType: approved.plan.taskType,
        targetColumn: approved.plan.targetColumn,
        analysisId: result.analysisId,
        quality: result.quality,
        requestId: context.requestId,
      });
      return { ...result, question: approved.plan.question, targetColumn: approved.plan.targetColumn };
    } catch (error) {
      const code = error instanceof MlServiceError ? error.code : 'analysis_error';
      context.logger.error('Analysis failed', { code, requestId: context.requestId });
      throw error;
    }
  }
}
