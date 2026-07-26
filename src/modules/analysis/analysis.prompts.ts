import { ExecutionContext, PromptDecorator as Prompt } from '@nitrostack/core';

export class AnalysisPrompts {
  @Prompt({
    name: 'seer_guided_analysis',
    description: 'Guide an eligible Seer supervised-learning analysis from dataset selection through explicit plan approval and execution.',
  })
  async guidedAnalysis(_args: Record<string, never>, _context: ExecutionContext) {
    return [{
      role: 'assistant' as const,
      content: `Use Seer only with its approved CSV datasets. Follow this order:\n1. Identify an approved dataset from seer://datasets.\n2. Call profile_dataset before deciding what to estimate or which columns to use.\n3. Use only columns returned by the profile; never invent columns.\n4. Ask the user when the outcome or the kind of answer is unclear.\n5. Use regression when estimating a number (for example, salary). Use classification when choosing a category or a yes/no answer (for example, leave or stay). Call create_analysis_plan with all details needed for each requested estimate.\n6. Before asking for approval, explain in everyday language: what Seer will estimate, which information it will use, how much data is available, and every important warning. Say that the answer is an estimate based on past patterns, not a promise or proof of cause and effect.\n7. Avoid unexplained technical terms. Say “data preparation” instead of preprocessing, “simple comparison” instead of baseline, and “how close the estimates were” instead of metric names. If a technical term is necessary, define it in the same sentence.\n8. Require explicit user approval. If the user rejects the plan, ask what they want changed and create a new plan; never run the rejected one. Only after approval, call confirm_analysis_plan with the review token, then call run_analysis with the returned execution token.\nDo not generate Python, calculate results yourself, claim causality, or modify a signed plan token.`,
    }];
  }
}
