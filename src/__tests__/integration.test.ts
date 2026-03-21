import { describe, it, expect, afterEach } from 'vitest';
import { createSpinner, createPipeline } from '../index';
import type { AISpinner } from '../types';
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

async function* mockOpenAIStream(chunks: number) {
  for (let i = 0; i < chunks; i++) {
    yield {
      choices: [{ delta: { content: `token${i}` } }],
    };
    // Small delay to allow TPS calculation
    await new Promise((r) => setTimeout(r, 10));
  }
  // Final chunk with usage
  yield {
    choices: [{ delta: {} }],
    usage: { prompt_tokens: 50, completion_tokens: chunks },
  };
}

async function* mockAnthropicStream() {
  yield {
    type: 'message_start',
    message: { usage: { input_tokens: 75 } },
  };
  yield {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  };
  for (let i = 0; i < 5; i++) {
    yield {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: `word${i} ` },
    };
    await new Promise((r) => setTimeout(r, 10));
  }
  yield {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn' },
    usage: { output_tokens: 20 },
  };
}

async function* mockTextStream(items: string[]) {
  for (const item of items) {
    yield item;
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('Integration Tests', () => {
  let spinner: AISpinner;

  afterEach(() => {
    if (spinner && spinner.isActive) {
      spinner.stop();
    }
  });

  describe('full spinner lifecycle with OpenAI stream', () => {
    it('transitions through all states and tracks metrics', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
        model: 'gpt-4o',
      });

      spinner.start('Calling GPT-4o...');
      expect(spinner.state).toBe('waiting');

      const stream = spinner.wrapStream(mockOpenAIStream(10), {
        format: 'openai',
      });

      // Consume the stream
      const chunks: unknown[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // 11 total chunks (10 content + 1 usage)
      expect(chunks.length).toBe(11);

      // Spinner should be in streaming state
      expect(spinner.state).toBe('streaming');

      // Metrics should be populated
      expect(spinner.metrics.outputTokens).toBe(10);
      expect(spinner.metrics.inputTokens).toBe(50);
      expect(spinner.metrics.ttftMs).toBeDefined();
      expect(spinner.metrics.elapsedMs).toBeGreaterThan(0);
      expect(spinner.metrics.cost).toBeGreaterThan(0);

      // Succeed to finalize
      spinner.succeed('Done');
      expect(spinner.state).toBe('complete');

      // Final output should contain summary
      const output = mock.output.join('');
      expect(output).toContain('Done');
    });
  });

  describe('full spinner lifecycle with Anthropic stream', () => {
    it('transitions and tracks metrics', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
        model: 'claude-sonnet-4-20250514',
      });

      spinner.start();

      const stream = spinner.wrapStream(mockAnthropicStream(), {
        format: 'anthropic',
      });

      for await (const _chunk of stream) {
        // consume
      }

      expect(spinner.state).toBe('streaming');
      expect(spinner.metrics.inputTokens).toBe(75);
      expect(spinner.metrics.outputTokens).toBe(20); // Corrected by message_delta
      expect(spinner.metrics.ttftMs).toBeDefined();

      spinner.succeed();
      expect(spinner.state).toBe('complete');
    });
  });

  describe('spinner with rate limiting', () => {
    it('handles rate limit and retry', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();
      expect(spinner.state).toBe('waiting');

      // Simulate rate limit
      spinner.rateLimited(3);
      expect(spinner.state).toBe('rate-limited');
      expect(spinner.metrics.countdownSeconds).toBe(3);

      // Retry
      spinner.streaming();
      expect(spinner.state).toBe('streaming');

      spinner.addTokens(10);
      spinner.succeed('Retry succeeded');
      expect(spinner.state).toBe('complete');
    });
  });

  describe('spinner with tool calls', () => {
    it('handles tool call transitions', () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();
      spinner.toolCall('search', { index: 1, total: 2 });
      expect(spinner.state).toBe('tool-calling');

      spinner.toolCall('calculate', { index: 2, total: 2 });
      expect(spinner.state).toBe('tool-calling');

      spinner.streaming();
      expect(spinner.state).toBe('streaming');

      spinner.addTokens(50);
      spinner.succeed('Tools complete');
      expect(spinner.state).toBe('complete');
    });
  });

  describe('pipeline end-to-end', () => {
    it('processes all steps', async () => {
      const mock = createMockStream();
      const pipeline = createPipeline(
        [
          { name: 'Retrieve documents' },
          { name: 'Embed chunks', total: 100 },
          { name: 'Generate response' },
        ],
        { stream: mock.stream },
      );

      pipeline.start();
      expect(pipeline.currentStep).toBe(0);

      // Step 1
      await new Promise((r) => setTimeout(r, 20));
      pipeline.next();
      expect(pipeline.currentStep).toBe(1);

      // Step 2 with progress
      pipeline.update({ progress: 50 });
      pipeline.next();
      expect(pipeline.currentStep).toBe(2);

      // Step 3 with tokens
      pipeline.addTokens(100);
      pipeline.setCost(0.01);
      pipeline.next();

      expect(pipeline.isComplete).toBe(true);
    });
  });

  describe('disabled spinner end-to-end', () => {
    it('produces no output', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: false,
      });

      spinner.start();
      spinner.streaming();
      spinner.addTokens(100);
      spinner.succeed('Done');

      expect(mock.output.length).toBe(0);
    });
  });

  describe('non-TTY end-to-end', () => {
    it('produces clean text output', () => {
      const mock = createMockStream(false);
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start('Working...');
      spinner.streaming();
      spinner.addTokens(100);
      spinner.succeed('Complete');

      const output = mock.output.join('');
      // Should not contain ANSI escape sequences
      expect(output).not.toMatch(/\x1b\[\?25[lh]/);
      expect(output).toContain('Complete');
    });
  });

  describe('ora migration compatibility', () => {
    it('supports ora-style usage', () => {
      const mock = createMockStream();
      spinner = createSpinner({
        text: 'Loading...',
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();
      expect(spinner.state).toBe('waiting');
      expect(spinner.text).toBe('Loading...');

      spinner.succeed('All done!');
      expect(spinner.state).toBe('complete');

      const output = mock.output.join('');
      expect(output).toContain('All done!');
    });
  });

  describe('generic text stream wrapping', () => {
    it('wraps and counts tokens from text stream', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();

      const textStream = mockTextStream(['Hello ', 'world ', 'this ', 'is ', 'a test.']);
      const wrapped = spinner.wrapStream(textStream, { format: 'text' });

      const chunks: string[] = [];
      for await (const chunk of wrapped) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello ', 'world ', 'this ', 'is ', 'a test.']);
      expect(spinner.state).toBe('streaming');
      expect(spinner.metrics.outputTokens).toBeGreaterThan(0);

      spinner.succeed();
    });
  });

  describe('auto-detection', () => {
    it('auto-detects OpenAI format', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();

      const stream = spinner.wrapStream(mockOpenAIStream(3), { format: 'auto' });
      for await (const _chunk of stream) {
        // consume
      }

      expect(spinner.state).toBe('streaming');
      expect(spinner.metrics.outputTokens).toBe(3); // Corrected by usage
      spinner.succeed();
    });

    it('auto-detects Anthropic format', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();

      const stream = spinner.wrapStream(mockAnthropicStream(), { format: 'auto' });
      for await (const _chunk of stream) {
        // consume
      }

      expect(spinner.state).toBe('streaming');
      expect(spinner.metrics.inputTokens).toBe(75);
      spinner.succeed();
    });
  });

  describe('error propagation in stream', () => {
    it('propagates errors from the underlying stream', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();

      async function* errorStream() {
        yield { choices: [{ delta: { content: 'hello' } }] };
        yield { choices: [{ delta: { content: 'world' } }] };
        throw new Error('Stream error');
      }

      const wrapped = spinner.wrapStream(errorStream(), { format: 'openai' });

      await expect(async () => {
        for await (const _chunk of wrapped) {
          // consume
        }
      }).rejects.toThrow('Stream error');

      // Spinner should still be in streaming state (not auto-transitioned)
      expect(spinner.state).toBe('streaming');
      spinner.fail('Stream failed');
    });
  });

  describe('stream does not auto-succeed', () => {
    it('remains in streaming after full consumption', async () => {
      const mock = createMockStream();
      spinner = createSpinner({
        stream: mock.stream,
        enabled: true,
      });

      spinner.start();

      const stream = spinner.wrapStream(mockOpenAIStream(5), { format: 'openai' });
      for await (const _chunk of stream) {
        // consume
      }

      // Should still be streaming, not auto-complete
      expect(spinner.state).toBe('streaming');
      spinner.succeed();
    });
  });
});
