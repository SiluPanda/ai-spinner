import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSpinner } from '../spinner';
import type { AISpinner } from '../types';
import { Writable } from 'stream';

/**
 * Create a mock writable stream that captures output.
 */
function createMockStream(isTTY = false): {
  stream: NodeJS.WritableStream & { isTTY?: boolean; columns?: number };
  output: string[];
} {
  const output: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  }) as NodeJS.WritableStream & { isTTY?: boolean; columns?: number };

  (stream as any).isTTY = isTTY;
  (stream as any).columns = 120;

  return { stream, output };
}

describe('createSpinner', () => {
  let spinner: AISpinner;
  let mockStream: ReturnType<typeof createMockStream>;

  beforeEach(() => {
    mockStream = createMockStream(false);
  });

  afterEach(() => {
    if (spinner && spinner.isActive) {
      spinner.stop();
    }
  });

  describe('initial state', () => {
    it('creates spinner in idle state', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      expect(spinner.state).toBe('idle');
      expect(spinner.isActive).toBe(false);
    });

    it('has default text', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      expect(spinner.text).toBe('Working...');
    });
  });

  describe('start()', () => {
    it('transitions to waiting', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      expect(spinner.state).toBe('waiting');
      expect(spinner.isActive).toBe(true);
    });

    it('accepts text override', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start('Loading...');
      expect(spinner.text).toBe('Loading...');
    });
  });

  describe('streaming()', () => {
    it('transitions from waiting to streaming', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      expect(spinner.state).toBe('streaming');
    });

    it('accepts streaming options', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming({ text: 'Generating...', model: 'gpt-4o', inputTokens: 100 });
      expect(spinner.text).toBe('Generating...');
    });
  });

  describe('toolCall()', () => {
    it('transitions from waiting to tool-calling', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.toolCall('search');
      expect(spinner.state).toBe('tool-calling');
    });

    it('transitions from streaming to tool-calling', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.toolCall('search');
      expect(spinner.state).toBe('tool-calling');
    });

    it('accepts tool call options', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.toolCall('search', { index: 1, total: 3 });
      expect(spinner.state).toBe('tool-calling');
    });
  });

  describe('rateLimited()', () => {
    it('transitions from waiting to rate-limited', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.rateLimited(30);
      expect(spinner.state).toBe('rate-limited');
    });

    it('transitions from streaming to rate-limited', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.rateLimited(30);
      expect(spinner.state).toBe('rate-limited');
    });

    it('transitions from tool-calling to rate-limited', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.toolCall('search');
      spinner.rateLimited(30);
      expect(spinner.state).toBe('rate-limited');
    });

    it('sets countdown seconds in metrics', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.rateLimited(30);
      expect(spinner.metrics.countdownSeconds).toBe(30);
    });
  });

  describe('processing()', () => {
    it('transitions from streaming to processing', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.processing('Parsing...');
      expect(spinner.state).toBe('processing');
      expect(spinner.text).toBe('Parsing...');
    });

    it('transitions from waiting to processing', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.processing();
      expect(spinner.state).toBe('processing');
    });
  });

  describe('succeed()', () => {
    it('transitions from waiting to complete', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.succeed('Done');
      expect(spinner.state).toBe('complete');
      expect(spinner.isActive).toBe(false);
    });

    it('transitions from streaming to complete', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.succeed();
      expect(spinner.state).toBe('complete');
    });

    it('transitions from tool-calling to complete', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.toolCall('search');
      spinner.succeed();
      expect(spinner.state).toBe('complete');
    });

    it('transitions from rate-limited to complete', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.rateLimited(30);
      spinner.succeed();
      expect(spinner.state).toBe('complete');
    });

    it('transitions from processing to complete', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.processing();
      spinner.succeed();
      expect(spinner.state).toBe('complete');
    });

    it('writes final line to non-TTY stream', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.succeed('All done');
      const joined = mockStream.output.join('');
      expect(joined).toContain('All done');
    });
  });

  describe('fail()', () => {
    it('transitions from waiting to error', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.fail('Something broke');
      expect(spinner.state).toBe('error');
      expect(spinner.isActive).toBe(false);
    });

    it('transitions from streaming to error', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.fail();
      expect(spinner.state).toBe('error');
    });

    it('transitions from tool-calling to error', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.toolCall('search');
      spinner.fail();
      expect(spinner.state).toBe('error');
    });

    it('transitions from rate-limited to error', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.rateLimited(30);
      spinner.fail();
      expect(spinner.state).toBe('error');
    });

    it('transitions from processing to error', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.processing();
      spinner.fail();
      expect(spinner.state).toBe('error');
    });
  });

  describe('terminal states', () => {
    it('start() from complete is a no-op', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.succeed();
      spinner.start();
      expect(spinner.state).toBe('complete');
    });

    it('start() from error is a no-op', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.fail();
      spinner.start();
      expect(spinner.state).toBe('error');
    });
  });

  describe('reset()', () => {
    it('resets from complete to idle', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.succeed();
      spinner.reset();
      expect(spinner.state).toBe('idle');
    });

    it('resets from error to idle', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.fail();
      spinner.reset();
      expect(spinner.state).toBe('idle');
    });

    it('clears metrics on reset', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.addTokens(100);
      spinner.succeed();
      spinner.reset();
      expect(spinner.metrics.outputTokens).toBe(0);
    });
  });

  describe('text property', () => {
    it('gets and sets text', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.text = 'New text';
      expect(spinner.text).toBe('New text');
    });
  });

  describe('method chaining', () => {
    it('supports chaining', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      const result = spinner.start().streaming().addTokens(5).succeed();
      expect(result).toBe(spinner);
      expect(spinner.state).toBe('complete');
    });
  });

  describe('addTokens', () => {
    it('increments output tokens', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.addTokens(10);
      expect(spinner.metrics.outputTokens).toBe(10);
    });

    it('defaults to 1 token', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      spinner.streaming();
      spinner.addTokens();
      expect(spinner.metrics.outputTokens).toBe(1);
    });
  });

  describe('disabled spinner', () => {
    it('all methods are no-ops when enabled=false', () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: false });
      spinner.start();
      spinner.streaming();
      spinner.addTokens(10);
      spinner.succeed();
      expect(mockStream.output.length).toBe(0);
    });
  });

  describe('elapsed time tracking', () => {
    it('tracks elapsed time after start', async () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      await new Promise((r) => setTimeout(r, 60));
      const elapsed = spinner.metrics.elapsedMs;
      expect(elapsed).toBeGreaterThan(30);
      spinner.stop();
    });
  });

  describe('TTFT measurement', () => {
    it('records TTFT on streaming transition', async () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      await new Promise((r) => setTimeout(r, 50));
      spinner.streaming();
      const ttft = spinner.metrics.ttftMs;
      expect(ttft).toBeDefined();
      expect(ttft!).toBeGreaterThan(30);
      spinner.stop();
    });

    it('does not re-record TTFT on second streaming call', async () => {
      spinner = createSpinner({ stream: mockStream.stream, enabled: true });
      spinner.start();
      await new Promise((r) => setTimeout(r, 50));
      spinner.streaming();
      const firstTTFT = spinner.metrics.ttftMs;

      await new Promise((r) => setTimeout(r, 50));
      spinner.toolCall('test');
      spinner.streaming();
      expect(spinner.metrics.ttftMs).toBe(firstTTFT);
      spinner.stop();
    });
  });

  describe('auto cost calculation', () => {
    it('calculates cost from model pricing', () => {
      spinner = createSpinner({
        stream: mockStream.stream,
        enabled: true,
        model: 'gpt-4o',
      });
      spinner.start();
      spinner.streaming({ inputTokens: 1000 });
      spinner.addTokens(500);
      const cost = spinner.metrics.cost;
      // input: 1000 * 2.5 / 1M = 0.0025
      // output: 500 * 10.0 / 1M = 0.005
      // total: 0.0075
      expect(cost).toBeCloseTo(0.0075, 4);
      spinner.stop();
    });
  });
});
