import type { ModelPricing } from './types';

/**
 * Built-in pricing table for common LLM models.
 * Values are cost per million tokens in dollars.
 */
const BUILT_IN_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { inputCostPerMillion: 2.5, outputCostPerMillion: 10.0 },
  'gpt-4o-mini': { inputCostPerMillion: 0.15, outputCostPerMillion: 0.6 },
  'gpt-4-turbo': { inputCostPerMillion: 10.0, outputCostPerMillion: 30.0 },
  'gpt-4': { inputCostPerMillion: 30.0, outputCostPerMillion: 60.0 },
  'gpt-3.5-turbo': { inputCostPerMillion: 0.5, outputCostPerMillion: 1.5 },
  'o1': { inputCostPerMillion: 15.0, outputCostPerMillion: 60.0 },
  'o1-mini': { inputCostPerMillion: 3.0, outputCostPerMillion: 12.0 },
  'o3': { inputCostPerMillion: 10.0, outputCostPerMillion: 40.0 },
  'o3-mini': { inputCostPerMillion: 1.1, outputCostPerMillion: 4.4 },
  'claude-opus-4-20250514': { inputCostPerMillion: 15.0, outputCostPerMillion: 75.0 },
  'claude-sonnet-4-20250514': { inputCostPerMillion: 3.0, outputCostPerMillion: 15.0 },
  'claude-haiku-3-5': { inputCostPerMillion: 0.8, outputCostPerMillion: 4.0 },
  'gemini-2.0-flash': { inputCostPerMillion: 0.075, outputCostPerMillion: 0.3 },
  'gemini-2.0-pro': { inputCostPerMillion: 1.25, outputCostPerMillion: 5.0 },
};

/**
 * Look up pricing for a model. Custom pricing takes priority over built-in.
 */
export function getModelPricing(
  model: string,
  customPricing?: ModelPricing,
): ModelPricing | undefined {
  if (customPricing) return customPricing;
  return BUILT_IN_PRICING[model];
}

/**
 * Calculate cost from token counts and pricing.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing,
): number {
  return (
    (inputTokens * pricing.inputCostPerMillion) / 1_000_000 +
    (outputTokens * pricing.outputCostPerMillion) / 1_000_000
  );
}

/**
 * Exported for testing and external use.
 */
export { BUILT_IN_PRICING };
