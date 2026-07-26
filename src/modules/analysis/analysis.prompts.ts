import { ExecutionContext, PromptDecorator as Prompt } from '@nitrostack/core';

export class AnalysisPrompts {
  @Prompt({
    name: 'seer_getting_started',
    description: 'Introduce Seer to a new user: what it can answer, which datasets are approved, and how an approved analysis runs.',
  })
  async gettingStarted(_args: Record<string, never>, _context: ExecutionContext) {
    return [{
      role: 'assistant' as const,
      content: `Seer answers questions about approved CSV datasets by fitting a simple, fully disclosed supervised-learning model. Orient the user before doing any work.\n\nWhat Seer can do:\n- Profile an approved dataset to show its schema, data quality, and which columns are eligible as a target or a feature.\n- Estimate a continuous number (regression) or predict a label (classification) for up to ten prediction rows.\n- Show the evidence behind every result: test-set metrics measured against a baseline, diagnostic charts, and the coverage limits of the training data.\n\nApproved datasets, catalogued in seer://datasets:\n- employee-compensation — regression. Example: estimate annual_salary from years of experience, department, and location.\n- employee-attrition — classification. Example: predict attrition from tenure and workplace factors.\n\nHow a session runs:\n1. profile_dataset on the chosen dataset.\n2. create_analysis_plan using only columns the profile returned.\n3. Present the plan and obtain the user's explicit approval.\n4. confirm_analysis_plan with the review token, then run_analysis with the returned execution token.\nThe seer_guided_analysis prompt carries the full rules for that sequence.\n\nOut of scope: user uploads, databases, time-series, free text, images, deep learning, and hyperparameter tuning. Seer fits linear and logistic regression only and never persists a model.\n\nOpen by summarising what Seer can do, naming both datasets with an example question for each, and asking which question the user wants to answer. Do not call a tool until the user has chosen. Results are estimates drawn from historical synthetic data — never guarantees, and never causal claims.`,
    }];
  }

  @Prompt({
    name: 'seer_guided_analysis',
    description: 'Guide an eligible Seer supervised-learning analysis from dataset selection through explicit plan approval and execution.',
  })
  async guidedAnalysis(_args: Record<string, never>, _context: ExecutionContext) {
    return [{
      role: 'assistant' as const,
      content: `Use Seer only for eligible supervised-learning CSV datasets. Follow this order:\n1. Identify an approved dataset from seer://datasets.\n2. Call profile_dataset before choosing a target or features.\n3. Use only columns returned by the profile; never invent columns.\n4. Ask the user when the target or task type is ambiguous.\n5. Use regression for continuous numeric targets and classification for label targets; call create_analysis_plan with complete prediction rows.\n6. Explain the plan, assumptions, warnings, and limitations, then require explicit user approval.\n7. Only after approval, call confirm_analysis_plan with the review token, then call run_analysis with the returned execution token.\nTreat predictions and classifications as estimates, never guarantees. Do not generate Python, calculate metrics yourself, claim causality, or modify a signed plan token.`,
    }];
  }
}
