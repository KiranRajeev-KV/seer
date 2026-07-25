import { ExecutionContext, Injectable, ToolDecorator as Tool, Widget, z } from '@nitrostack/core';
import {
  confirmAnalysisPlanInputSchema,
  confirmAnalysisPlanResponseSchema,
  createAnalysisPlanInputSchema,
  createAnalysisPlanResponseSchema,
} from './analysis.schemas.js';
import { AnalysisService } from './analysis.service.js';

@Injectable({ deps: [AnalysisService] })
export class AnalysisTools {
  constructor(private readonly analysis: AnalysisService) {}

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
    description: 'Confirm a user-approved Seer analysis plan. Verifies its signature, expiration, and dataset hash; it does not train a model.',
    inputSchema: confirmAnalysisPlanInputSchema,
    outputSchema: confirmAnalysisPlanResponseSchema,
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  })
  async confirmAnalysisPlan(input: z.infer<typeof confirmAnalysisPlanInputSchema>, context: ExecutionContext) {
    const result = await this.analysis.confirm(input.planToken);
    context.logger.info('Analysis plan confirmed', {
      datasetId: result.plan.datasetId,
      taskType: result.plan.taskType,
      requestId: context.requestId,
    });
    return result;
  }
}
