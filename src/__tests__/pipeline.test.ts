import { describe, it, expect, beforeEach } from 'vitest';
import { createPipeline } from '../pipeline';
import type { AIPipeline } from '../types';
import { Writable } from 'stream';

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

describe('createPipeline', () => {
  let pipeline: AIPipeline;
  let mockStream: ReturnType<typeof createMockStream>;

  beforeEach(() => {
    mockStream = createMockStream(false);
  });

  describe('creation', () => {
    it('creates pipeline with correct step count', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        { stream: mockStream.stream },
      );
      expect(pipeline.totalSteps).toBe(3);
      expect(pipeline.currentStep).toBe(0);
      expect(pipeline.isComplete).toBe(false);
    });

    it('creates empty pipeline', () => {
      pipeline = createPipeline([], { stream: mockStream.stream });
      expect(pipeline.totalSteps).toBe(0);
    });
  });

  describe('start()', () => {
    it('starts the pipeline', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      expect(pipeline.currentStep).toBe(0);
    });
  });

  describe('next()', () => {
    it('advances to next step', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.next();
      expect(pipeline.currentStep).toBe(1);
    });

    it('completes after last step', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.next();
      pipeline.next();
      expect(pipeline.isComplete).toBe(true);
      expect(pipeline.currentStep).toBe(2);
    });

    it('outputs step completion in non-TTY mode', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.next();
      const output = mockStream.output.join('');
      expect(output).toContain('A');
      expect(output).toContain('done');
    });
  });

  describe('complete()', () => {
    it('completes all remaining steps', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.next(); // complete step 0
      pipeline.complete(); // complete steps 1 and 2
      expect(pipeline.isComplete).toBe(true);
    });
  });

  describe('fail()', () => {
    it('marks current step as failed', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.next(); // complete step 0
      pipeline.fail('Error occurred');
      expect(pipeline.isComplete).toBe(true);
    });

    it('outputs failure text', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.fail('Something broke');
      const output = mockStream.output.join('');
      expect(output).toContain('A');
    });
  });

  describe('update()', () => {
    it('updates progress', () => {
      pipeline = createPipeline(
        [{ name: 'Embedding', total: 100 }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.update({ progress: 47 });
      // Progress is stored internally; we can verify via next() output
      pipeline.next();
      expect(pipeline.isComplete).toBe(true);
    });

    it('updates text', () => {
      pipeline = createPipeline(
        [{ name: 'Step' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.update({ text: 'Custom status' });
      pipeline.next();
    });
  });

  describe('addTokens()', () => {
    it('adds tokens to current step', () => {
      pipeline = createPipeline(
        [{ name: 'Generate' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.addTokens(10);
      pipeline.addTokens(5);
      // Internal state tracked; no direct accessor but no errors
      pipeline.next();
    });

    it('defaults to 1 token', () => {
      pipeline = createPipeline(
        [{ name: 'Generate' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.addTokens();
      pipeline.next();
    });
  });

  describe('setCost()', () => {
    it('sets cost for current step', () => {
      pipeline = createPipeline(
        [{ name: 'Generate' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.setCost(0.005);
      pipeline.next();
    });
  });

  describe('setTPS()', () => {
    it('sets TPS for current step', () => {
      pipeline = createPipeline(
        [{ name: 'Generate' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.setTPS(42.5);
      pipeline.next();
    });
  });

  describe('per-step duration', () => {
    it('tracks step duration', async () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      await new Promise((r) => setTimeout(r, 60));
      pipeline.next();
      // In non-TTY mode, the output includes duration
      const output = mockStream.output.join('');
      expect(output).toContain('done');
    });
  });

  describe('non-TTY output', () => {
    it('produces no ANSI escape codes', () => {
      pipeline = createPipeline(
        [{ name: 'A' }, { name: 'B' }],
        { stream: mockStream.stream },
      );
      pipeline.start();
      pipeline.next();
      pipeline.next();
      const output = mockStream.output.join('');
      // Should not contain ANSI escape sequences
      expect(output).not.toMatch(/\x1b\[/);
    });
  });
});
