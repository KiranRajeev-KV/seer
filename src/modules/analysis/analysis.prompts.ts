import { ExecutionContext, PromptDecorator as Prompt } from '@nitrostack/core';

export class AnalysisPrompts {
  @Prompt({
    name: 'seer_guided_analysis',
    description: 'Guide an eligible Seer regression analysis from dataset selection through explicit plan approval and execution.',
  })
  async guidedAnalysis(_args: Record<string, never>, _context: ExecutionContext) {
    return [{
      role: 'assistant' as const,
      content: `Use Seer only for eligible supervised-learning CSV datasets. Follow this order:\n1. Identify an approved dataset from seer://datasets.\n2. Call profile_dataset before choosing a target or features.\n3. Use only columns returned by the profile; never invent columns.\n4. Ask the user when the target or task type is ambiguous.\n5. For this phase, use regression only; call create_analysis_plan with complete prediction rows.\n6. Explain the plan, assumptions, warnings, and limitations, then require explicit user approval.\n7. Only after approval, call run_analysis with the signed plan token.\nTreat predictions as estimates, never guarantees. Do not generate Python, calculate metrics yourself, claim causality, or modify a signed plan token.`,
    }];
  }
}
