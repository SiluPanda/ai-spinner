import type { AISpinner, WrapStreamOptions } from './types';

type StreamFormat = 'openai' | 'anthropic' | 'text';

/**
 * Detect the format of a stream chunk.
 */
function detectFormat(chunk: unknown): StreamFormat {
  if (chunk && typeof chunk === 'object') {
    const obj = chunk as Record<string, unknown>;
    // OpenAI: has choices array with delta
    if (Array.isArray(obj.choices)) {
      const choice = (obj.choices as Record<string, unknown>[])[0];
      if (choice && typeof choice === 'object' && 'delta' in choice) {
        return 'openai';
      }
    }
    // Anthropic: has type field matching known event types
    if (
      typeof obj.type === 'string' &&
      (obj.type === 'content_block_delta' ||
        obj.type === 'message_start' ||
        obj.type === 'message_delta' ||
        obj.type === 'content_block_start' ||
        obj.type === 'content_block_stop')
    ) {
      return 'anthropic';
    }
  }
  return 'text';
}

/**
 * Extract content from an OpenAI chunk and count tokens.
 * Returns the number of tokens to add (0 if no content).
 */
function processOpenAIChunk(
  chunk: unknown,
  spinner: AISpinner,
  isFirst: boolean,
): boolean {
  const obj = chunk as Record<string, unknown>;

  // Check for usage in the final chunk
  if (obj.usage && typeof obj.usage === 'object') {
    const usage = obj.usage as Record<string, unknown>;
    if (typeof usage.prompt_tokens === 'number') {
      spinner.setInputTokens(usage.prompt_tokens);
    }
    if (typeof usage.completion_tokens === 'number') {
      spinner.update({ outputTokens: usage.completion_tokens });
    }
  }

  // Extract content from delta
  if (Array.isArray(obj.choices)) {
    const choice = (obj.choices as Record<string, unknown>[])[0];
    if (choice && typeof choice === 'object') {
      const delta = (choice as Record<string, unknown>).delta;
      if (delta && typeof delta === 'object') {
        const content = (delta as Record<string, unknown>).content;
        if (typeof content === 'string' && content.length > 0) {
          if (isFirst) {
            spinner.streaming();
          }
          spinner.addTokens(1);
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Process an Anthropic stream event.
 */
function processAnthropicChunk(
  chunk: unknown,
  spinner: AISpinner,
  isFirst: boolean,
): boolean {
  const obj = chunk as Record<string, unknown>;
  const type = obj.type as string;

  if (type === 'message_start') {
    // Extract input tokens
    const message = obj.message as Record<string, unknown> | undefined;
    if (message?.usage && typeof message.usage === 'object') {
      const usage = message.usage as Record<string, unknown>;
      if (typeof usage.input_tokens === 'number') {
        spinner.setInputTokens(usage.input_tokens);
      }
    }
    return false;
  }

  if (type === 'content_block_delta') {
    const delta = obj.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta.text === 'string' && delta.text.length > 0) {
      if (isFirst) {
        spinner.streaming();
      }
      // Estimate tokens from text length
      const estimatedTokens = Math.max(1, Math.ceil(delta.text.length / 4));
      spinner.addTokens(estimatedTokens);
      return true;
    }
    return false;
  }

  if (type === 'message_delta') {
    // Correct output tokens from final usage
    const usage = obj.usage as Record<string, unknown> | undefined;
    if (usage && typeof usage.output_tokens === 'number') {
      spinner.update({ outputTokens: usage.output_tokens });
    }
    return false;
  }

  return false;
}

/**
 * Process a generic text chunk.
 */
function processTextChunk(
  chunk: unknown,
  spinner: AISpinner,
  isFirst: boolean,
): boolean {
  const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
  if (text && text.length > 0) {
    if (isFirst) {
      spinner.streaming();
    }
    const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
    spinner.addTokens(estimatedTokens);
    return true;
  }
  return false;
}

/**
 * Wrap an async iterable stream with AI-spinner instrumentation.
 * The wrapped stream yields all original chunks unchanged.
 * The spinner is automatically transitioned to streaming and tokens are counted.
 */
export function wrapStream<T>(
  stream: AsyncIterable<T>,
  spinner: AISpinner,
  options?: WrapStreamOptions,
): AsyncIterable<T> {
  const requestedFormat = options?.format ?? 'auto';

  if (options?.text !== undefined) {
    spinner.text = options.text;
  }
  if (options?.model !== undefined) {
    spinner.update({ model: options.model });
  }
  if (options?.inputTokens !== undefined) {
    spinner.setInputTokens(options.inputTokens);
  }

  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      const iterator = stream[Symbol.asyncIterator]();
      let detectedFormat: StreamFormat | undefined;
      let hasReceivedContent = false;

      return {
        async next(): Promise<IteratorResult<T>> {
          const result = await iterator.next();
          if (result.done) return result;

          const chunk = result.value;

          // Detect format on first chunk if auto
          if (detectedFormat === undefined) {
            detectedFormat =
              requestedFormat === 'auto'
                ? detectFormat(chunk)
                : requestedFormat;
          }

          const isFirst = !hasReceivedContent;

          switch (detectedFormat) {
            case 'openai':
              if (processOpenAIChunk(chunk, spinner, isFirst)) {
                hasReceivedContent = true;
              }
              break;
            case 'anthropic':
              if (processAnthropicChunk(chunk, spinner, isFirst)) {
                hasReceivedContent = true;
              }
              break;
            case 'text':
            default:
              if (processTextChunk(chunk, spinner, isFirst)) {
                hasReceivedContent = true;
              }
              break;
          }

          return result;
        },
      };
    },
  };
}
