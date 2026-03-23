import { describe, it, expect } from 'vitest';
import { wrapStream } from '../stream';
import type { AISpinner, SpinnerMetrics } from '../types';

// ── Mock Spinner ──────────────────────────────────────────────────────────

function createMockSpinner(): AISpinner & { calls: string[] } {
  const calls: string[] = [];
  const metrics: SpinnerMetrics = {
    outputTokens: 0,
    inputTokens: 0,
    tps: 0,
    cost: 0,
    elapsedMs: 0,
  };
  const spinner: AISpinner & { calls: string[] } = {
    calls,
    start() { calls.push('start'); return spinner; },
    stop() { calls.push('stop'); return spinner; },
    reset() { calls.push('reset'); return spinner; },
    streaming(_opts?: any) { calls.push('streaming'); return spinner; },
    toolCall(name: string) { calls.push(`toolCall:${name}`); return spinner; },
    rateLimited(seconds: number) { calls.push(`rateLimited:${seconds}`); return spinner; },
    processing() { calls.push('processing'); return spinner; },
    succeed(_text?: string) { calls.push('succeed'); return spinner; },
    fail(_text?: string) { calls.push('fail'); return spinner; },
    addTokens(count?: number) {
      const n = count ?? 1;
      metrics.outputTokens += n;
      calls.push(`addTokens:${n}`);
      return spinner;
    },
    setInputTokens(count: number) {
      metrics.inputTokens = count;
      calls.push(`setInputTokens:${count}`);
      return spinner;
    },
    setTPS(rate: number) { calls.push(`setTPS:${rate}`); return spinner; },
    setCost(cost: number) { calls.push(`setCost:${cost}`); return spinner; },
    update(partial: Partial<SpinnerMetrics>) {
      if (partial.outputTokens !== undefined) metrics.outputTokens = partial.outputTokens;
      if (partial.model !== undefined) (metrics as any).model = partial.model;
      calls.push('update');
      return spinner;
    },
    wrapStream(stream: AsyncIterable<any>, opts?: any) {
      return wrapStream(stream, spinner, opts);
    },
    get text() { return ''; },
    set text(v: string) { /* noop */ },
    get state() { return 'idle' as const; },
    get metrics() { return { ...metrics }; },
    get isActive() { return false; },
  };
  return spinner;
}

// ── Mock Stream Helpers ───────────────────────────────────────────────────

async function* makeOpenAIStream(chunks: number) {
  for (let i = 0; i < chunks; i++) {
    yield { choices: [{ delta: { content: `word${i}` } }] };
  }
}

async function* makeOpenAIStreamWithUsage(
  chunks: number,
  promptTokens: number,
  completionTokens: number,
) {
  for (let i = 0; i < chunks; i++) {
    yield { choices: [{ delta: { content: `word${i}` } }] };
  }
  yield {
    choices: [{ delta: {} }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}

async function* makeAnthropicStream(
  textChunks: string[],
  inputTokens: number,
  outputTokens: number,
) {
  yield { type: 'message_start', message: { usage: { input_tokens: inputTokens } } };
  for (const text of textChunks) {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
  }
  yield {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn' },
    usage: { output_tokens: outputTokens },
  };
}

async function* makeTextStream(texts: string[]) {
  for (const t of texts) {
    yield t;
  }
}

async function* makeErrorStream(goodChunks: number) {
  for (let i = 0; i < goodChunks; i++) {
    yield `chunk${i}`;
  }
  throw new Error('stream error');
}

// ── Consume Helper ────────────────────────────────────────────────────────

async function consume<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const chunk of stream) {
    results.push(chunk);
  }
  return results;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('wrapStream', () => {
  it('wraps OpenAI stream: transitions to streaming and counts tokens', async () => {
    const spinner = createMockSpinner();
    const wrapped = wrapStream(makeOpenAIStream(10), spinner, { format: 'openai' });
    const chunks = await consume(wrapped);

    expect(chunks).toHaveLength(10);
    expect(spinner.calls).toContain('streaming');
    expect(spinner.metrics.outputTokens).toBe(10);
  });

  it('extracts usage from final OpenAI chunk', async () => {
    const spinner = createMockSpinner();
    const wrapped = wrapStream(
      makeOpenAIStreamWithUsage(5, 50, 10),
      spinner,
      { format: 'openai' },
    );
    await consume(wrapped);

    expect(spinner.metrics.inputTokens).toBe(50);
    expect(spinner.metrics.outputTokens).toBe(10); // corrected by usage
  });

  it('wraps Anthropic stream: transitions, counts tokens, extracts input/output', async () => {
    const spinner = createMockSpinner();
    const texts = ['Hello ', 'world ', 'how ', 'are ', 'you?'];
    const wrapped = wrapStream(
      makeAnthropicStream(texts, 75, 20),
      spinner,
      { format: 'anthropic' },
    );
    const chunks = await consume(wrapped);

    // 5 text chunks + 1 message_start + 1 message_delta = 7 total chunks
    expect(chunks).toHaveLength(7);
    expect(spinner.calls).toContain('streaming');
    expect(spinner.metrics.inputTokens).toBe(75);
    expect(spinner.metrics.outputTokens).toBe(20); // corrected by message_delta
  });

  it('wraps generic text stream: transitions and estimates tokens from length', async () => {
    const spinner = createMockSpinner();
    const texts = ['Hello world', 'foo', 'bar baz qux'];
    const wrapped = wrapStream(makeTextStream(texts), spinner, { format: 'text' });
    const chunks = await consume(wrapped);

    expect(chunks).toHaveLength(3);
    expect(chunks).toEqual(texts);
    expect(spinner.calls).toContain('streaming');
    // Token estimation: ceil(len/4), min 1
    expect(spinner.metrics.outputTokens).toBeGreaterThan(0);
  });

  it('auto-detects OpenAI format', async () => {
    const spinner = createMockSpinner();
    const wrapped = wrapStream(makeOpenAIStream(3), spinner, { format: 'auto' });
    await consume(wrapped);

    expect(spinner.calls).toContain('streaming');
    expect(spinner.metrics.outputTokens).toBe(3);
  });

  it('auto-detects Anthropic format', async () => {
    const spinner = createMockSpinner();
    const wrapped = wrapStream(
      makeAnthropicStream(['hi'], 10, 5),
      spinner,
      { format: 'auto' },
    );
    await consume(wrapped);

    expect(spinner.calls).toContain('streaming');
    expect(spinner.metrics.inputTokens).toBe(10);
  });

  it('auto-detects generic text format as fallback', async () => {
    const spinner = createMockSpinner();
    const wrapped = wrapStream(
      makeTextStream(['hello', 'world']),
      spinner,
      { format: 'auto' },
    );
    await consume(wrapped);

    expect(spinner.calls).toContain('streaming');
  });

  it('propagates errors from underlying stream', async () => {
    const spinner = createMockSpinner();
    const wrapped = wrapStream(makeErrorStream(3), spinner, { format: 'text' });

    await expect(consume(wrapped)).rejects.toThrow('stream error');
    // Spinner should NOT be auto-transitioned to error
    expect(spinner.calls).not.toContain('fail');
  });

  it('does not auto-succeed when stream ends', async () => {
    const spinner = createMockSpinner();
    const wrapped = wrapStream(
      makeTextStream(['a', 'b', 'c']),
      spinner,
      { format: 'text' },
    );
    await consume(wrapped);

    expect(spinner.calls).not.toContain('succeed');
    expect(spinner.calls).not.toContain('fail');
  });
});
