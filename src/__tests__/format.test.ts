import { describe, it, expect } from 'vitest';
import {
  formatTokens,
  formatTPS,
  formatCost,
  formatElapsed,
  formatCountdown,
} from '../format';

describe('formatTokens', () => {
  it('formats zero', () => {
    expect(formatTokens(0)).toBe('0 tokens');
  });

  it('formats values below 1000 without commas', () => {
    expect(formatTokens(142)).toBe('142 tokens');
    expect(formatTokens(999)).toBe('999 tokens');
  });

  it('formats values >= 1000 with commas', () => {
    expect(formatTokens(1000)).toBe('1,000 tokens');
    expect(formatTokens(12345)).toBe('12,345 tokens');
    expect(formatTokens(1203)).toBe('1,203 tokens');
  });

  it('formats large values', () => {
    expect(formatTokens(1000000)).toBe('1,000,000 tokens');
  });
});

describe('formatTPS', () => {
  it('formats with one decimal place', () => {
    expect(formatTPS(38.24)).toBe('38.2 tok/s');
    expect(formatTPS(100.0)).toBe('100.0 tok/s');
  });

  it('formats values below 1.0', () => {
    expect(formatTPS(0.82)).toBe('0.8 tok/s');
    expect(formatTPS(0.0)).toBe('0.0 tok/s');
  });

  it('rounds correctly', () => {
    expect(formatTPS(38.25)).toBe('38.3 tok/s');
    expect(formatTPS(38.249)).toBe('38.2 tok/s');
  });
});

describe('formatCost', () => {
  it('formats values below $0.01 with 3 decimal places', () => {
    expect(formatCost(0.003)).toBe('$0.003');
    expect(formatCost(0.0034)).toBe('$0.003');
    expect(formatCost(0.0)).toBe('$0.000');
  });

  it('formats values between $0.01 and $1.00 with 2 decimal places', () => {
    expect(formatCost(0.12)).toBe('$0.12');
    expect(formatCost(0.99)).toBe('$0.99');
    expect(formatCost(0.01)).toBe('$0.01');
  });

  it('formats values above $1.00 with 2 decimal places', () => {
    expect(formatCost(1.24)).toBe('$1.24');
    expect(formatCost(1.239)).toBe('$1.24');
    expect(formatCost(10.5)).toBe('$10.50');
  });
});

describe('formatElapsed', () => {
  it('formats values under 60s as seconds', () => {
    expect(formatElapsed(2134)).toBe('2.1s');
    expect(formatElapsed(500)).toBe('0.5s');
    expect(formatElapsed(59900)).toBe('59.9s');
  });

  it('formats values >= 60s as minutes and seconds', () => {
    expect(formatElapsed(60000)).toBe('1m 0s');
    expect(formatElapsed(72000)).toBe('1m 12s');
    expect(formatElapsed(135000)).toBe('2m 15s');
  });

  it('formats zero', () => {
    expect(formatElapsed(0)).toBe('0.0s');
  });
});

describe('formatCountdown', () => {
  it('formats as integer seconds', () => {
    expect(formatCountdown(23)).toBe('23s');
    expect(formatCountdown(0)).toBe('0s');
    expect(formatCountdown(1)).toBe('1s');
  });

  it('truncates decimal values', () => {
    expect(formatCountdown(23.7)).toBe('23s');
  });
});
