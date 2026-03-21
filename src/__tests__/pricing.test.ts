import { describe, it, expect } from 'vitest';
import { getModelPricing, calculateCost, BUILT_IN_PRICING } from '../pricing';

describe('getModelPricing', () => {
  it('returns pricing for all built-in models', () => {
    const models = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
      'o3',
      'o3-mini',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-3-5',
      'gemini-2.0-flash',
      'gemini-2.0-pro',
    ];

    for (const model of models) {
      const pricing = getModelPricing(model);
      expect(pricing).toBeDefined();
      expect(pricing!.inputCostPerMillion).toBeGreaterThan(0);
      expect(pricing!.outputCostPerMillion).toBeGreaterThan(0);
    }
  });

  it('returns undefined for unknown models', () => {
    expect(getModelPricing('unknown-model')).toBeUndefined();
  });

  it('custom pricing overrides built-in', () => {
    const custom = { inputCostPerMillion: 99, outputCostPerMillion: 199 };
    const pricing = getModelPricing('gpt-4o', custom);
    expect(pricing).toBe(custom);
    expect(pricing!.inputCostPerMillion).toBe(99);
  });

  it('custom pricing works for unknown models', () => {
    const custom = { inputCostPerMillion: 1, outputCostPerMillion: 2 };
    const pricing = getModelPricing('my-custom-model', custom);
    expect(pricing).toBe(custom);
  });
});

describe('calculateCost', () => {
  it('calculates gpt-4o cost correctly', () => {
    const pricing = BUILT_IN_PRICING['gpt-4o'];
    // 1000 input, 500 output
    // input: 1000 * 2.5 / 1_000_000 = 0.0025
    // output: 500 * 10.0 / 1_000_000 = 0.005
    // total: 0.0075
    const cost = calculateCost(1000, 500, pricing);
    expect(cost).toBeCloseTo(0.0075, 6);
  });

  it('returns 0 for zero tokens', () => {
    const pricing = BUILT_IN_PRICING['gpt-4o'];
    expect(calculateCost(0, 0, pricing)).toBe(0);
  });

  it('calculates with custom pricing', () => {
    const pricing = { inputCostPerMillion: 10, outputCostPerMillion: 20 };
    // 1_000_000 input, 500_000 output
    // input: 10, output: 10, total: 20
    const cost = calculateCost(1_000_000, 500_000, pricing);
    expect(cost).toBe(20);
  });

  it('handles input-only cost', () => {
    const pricing = BUILT_IN_PRICING['gpt-4o'];
    const cost = calculateCost(1000, 0, pricing);
    expect(cost).toBeCloseTo(0.0025, 6);
  });

  it('handles output-only cost', () => {
    const pricing = BUILT_IN_PRICING['gpt-4o'];
    const cost = calculateCost(0, 1000, pricing);
    expect(cost).toBeCloseTo(0.01, 6);
  });
});

describe('BUILT_IN_PRICING', () => {
  it('has correct gpt-4o pricing', () => {
    expect(BUILT_IN_PRICING['gpt-4o'].inputCostPerMillion).toBe(2.5);
    expect(BUILT_IN_PRICING['gpt-4o'].outputCostPerMillion).toBe(10.0);
  });

  it('has correct claude-opus-4-20250514 pricing', () => {
    expect(BUILT_IN_PRICING['claude-opus-4-20250514'].inputCostPerMillion).toBe(15.0);
    expect(BUILT_IN_PRICING['claude-opus-4-20250514'].outputCostPerMillion).toBe(75.0);
  });

  it('has 14 models', () => {
    expect(Object.keys(BUILT_IN_PRICING).length).toBe(14);
  });
});
