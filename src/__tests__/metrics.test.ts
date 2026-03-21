import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsTracker } from '../metrics';

describe('MetricsTracker', () => {
  let tracker: MetricsTracker;

  beforeEach(() => {
    tracker = new MetricsTracker();
  });

  describe('addTokens', () => {
    it('increments output tokens by 1 by default', () => {
      tracker.addTokens();
      expect(tracker.getMetrics().outputTokens).toBe(1);
    });

    it('increments output tokens by specified count', () => {
      tracker.addTokens(5);
      expect(tracker.getMetrics().outputTokens).toBe(5);
    });

    it('accumulates tokens across multiple calls', () => {
      tracker.addTokens(3);
      tracker.addTokens(7);
      expect(tracker.getMetrics().outputTokens).toBe(10);
    });
  });

  describe('setInputTokens', () => {
    it('sets input tokens', () => {
      tracker.setInputTokens(100);
      expect(tracker.getMetrics().inputTokens).toBe(100);
    });
  });

  describe('setOutputTokens', () => {
    it('sets output tokens directly', () => {
      tracker.setOutputTokens(50);
      expect(tracker.getMetrics().outputTokens).toBe(50);
    });
  });

  describe('setTPS', () => {
    it('sets TPS manually', () => {
      tracker.setTPS(42.5);
      expect(tracker.getMetrics().tps).toBe(42.5);
    });
  });

  describe('setCost', () => {
    it('sets cost', () => {
      tracker.setCost(0.005);
      expect(tracker.getMetrics().cost).toBe(0.005);
    });
  });

  describe('setModel', () => {
    it('sets model name', () => {
      tracker.setModel('gpt-4o');
      expect(tracker.getMetrics().model).toBe('gpt-4o');
    });
  });

  describe('update', () => {
    it('bulk-updates multiple metrics', () => {
      tracker.update({
        outputTokens: 100,
        inputTokens: 50,
        cost: 0.01,
        tps: 33.3,
      });
      const m = tracker.getMetrics();
      expect(m.outputTokens).toBe(100);
      expect(m.inputTokens).toBe(50);
      expect(m.cost).toBe(0.01);
      expect(m.tps).toBe(33.3);
    });
  });

  describe('reset', () => {
    it('resets all metrics to initial values', () => {
      tracker.addTokens(10);
      tracker.setInputTokens(50);
      tracker.setCost(0.01);
      tracker.setTPS(42.0);
      tracker.setModel('gpt-4o');
      tracker.startTimer();

      tracker.reset();
      const m = tracker.getMetrics();
      expect(m.outputTokens).toBe(0);
      expect(m.inputTokens).toBe(0);
      expect(m.cost).toBe(0);
      expect(m.tps).toBe(0);
      expect(m.model).toBeUndefined();
      expect(m.ttftMs).toBeUndefined();
    });
  });

  describe('elapsed time', () => {
    it('tracks elapsed time after startTimer', async () => {
      tracker.startTimer();
      await new Promise((r) => setTimeout(r, 50));
      const m = tracker.getMetrics();
      expect(m.elapsedMs).toBeGreaterThan(30);
      expect(m.elapsedMs).toBeLessThan(200);
    });

    it('returns 0 before startTimer', () => {
      expect(tracker.getMetrics().elapsedMs).toBe(0);
    });
  });

  describe('TTFT', () => {
    it('records time to first token', async () => {
      tracker.startTimer();
      await new Promise((r) => setTimeout(r, 50));
      tracker.recordTTFT();
      const m = tracker.getMetrics();
      expect(m.ttftMs).toBeDefined();
      expect(m.ttftMs!).toBeGreaterThan(30);
      expect(m.ttftMs!).toBeLessThan(200);
    });

    it('only records TTFT once', async () => {
      tracker.startTimer();
      await new Promise((r) => setTimeout(r, 50));
      tracker.recordTTFT();
      const firstTTFT = tracker.getMetrics().ttftMs;

      await new Promise((r) => setTimeout(r, 50));
      tracker.recordTTFT();
      expect(tracker.getMetrics().ttftMs).toBe(firstTTFT);
    });
  });

  describe('countdown', () => {
    it('sets and decrements countdown', () => {
      tracker.setCountdownSeconds(5);
      expect(tracker.getMetrics().countdownSeconds).toBe(5);

      tracker.decrementCountdown();
      expect(tracker.getMetrics().countdownSeconds).toBe(4);
    });

    it('stops at zero', () => {
      tracker.setCountdownSeconds(1);
      tracker.decrementCountdown();
      expect(tracker.getMetrics().countdownSeconds).toBe(0);
      tracker.decrementCountdown();
      expect(tracker.getMetrics().countdownSeconds).toBe(0);
    });

    it('clears countdown', () => {
      tracker.setCountdownSeconds(5);
      tracker.clearCountdown();
      expect(tracker.getMetrics().countdownSeconds).toBeUndefined();
    });
  });

  describe('TPS sliding window', () => {
    it('returns 0 with insufficient data (< 2 data points)', () => {
      tracker.addTokens(1);
      expect(tracker.getMetrics().tps).toBe(0);
    });

    it('calculates TPS from multiple data points', async () => {
      // Add tokens with delays to get a measurable TPS
      tracker.addTokens(10);
      await new Promise((r) => setTimeout(r, 100));
      tracker.addTokens(10);
      const tps = tracker.getMetrics().tps;
      // Should be roughly 100 tok/s (10 tokens / 0.1 seconds)
      expect(tps).toBeGreaterThan(20);
      expect(tps).toBeLessThan(500);
    });

    it('manually set TPS overrides auto-calculated', () => {
      tracker.addTokens(10);
      tracker.addTokens(10);
      tracker.setTPS(42.0);
      expect(tracker.getMetrics().tps).toBe(42.0);
    });
  });
});
