# ai-spinner

AI-aware terminal progress indicators with token counts, cost display, streaming throughput, and multi-step pipeline status.

[![npm version](https://img.shields.io/npm/v/ai-spinner.svg)](https://www.npmjs.com/package/ai-spinner)
[![npm downloads](https://img.shields.io/npm/dt/ai-spinner.svg)](https://www.npmjs.com/package/ai-spinner)
[![license](https://img.shields.io/npm/l/ai-spinner.svg)](https://github.com/SiluPanda/ai-spinner/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/ai-spinner.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

`ai-spinner` extends the familiar terminal spinner pattern with real-time display of LLM operation metrics. It understands the specific phases of LLM API interactions -- waiting for a response, streaming tokens, handling rate limits, executing tool calls -- and renders this information live in the terminal. Instead of a generic "Loading..." spinner, you see: `Generating... 142 tokens . 38.2 tok/s . $0.003`. The API is deliberately similar to `ora` so migration is trivial, but the additional methods expose AI-specific capabilities that general-purpose spinners cannot provide. Zero runtime dependencies.

## Installation

```bash
npm install ai-spinner
```

## Quick Start

```typescript
import { createSpinner } from 'ai-spinner';

const spinner = createSpinner({ model: 'gpt-4o' });
spinner.start('Calling GPT-4o...');

// When tokens start arriving
spinner.streaming({ inputTokens: 150 });

// As each chunk arrives
spinner.addTokens(1);

// When done
spinner.succeed('Response generated');
// Output: ✓ Response generated · 847 tokens · 2.1s · $0.012
```

## Features

- AI-specific spinner states: waiting, streaming, tool-calling, rate-limited, processing, complete, error
- Real-time token count, tokens per second (TPS), and cost display
- Built-in pricing for 14 models across OpenAI, Anthropic, and Google
- Automatic stream wrapping for OpenAI and Anthropic APIs with format auto-detection
- Multi-step pipeline progress with per-step metrics
- Rate-limit countdown timer with automatic decrement
- Tool call display with name and index tracking
- Token budget display (consumed / limit)
- Time-to-first-token (TTFT) measurement
- Configurable display templates, symbols, and animation presets
- Non-TTY fallback for CI environments (clean text output, no ANSI codes)
- Respects `NO_COLOR`, `FORCE_COLOR`, and `AI_SPINNER_ENABLED` environment variables
- Fluent API with full method chaining
- Zero runtime dependencies

## API Reference

### `createSpinner(options?)`

Creates and returns an `AISpinner` instance.

```typescript
import { createSpinner } from 'ai-spinner';

const spinner = createSpinner({
  text: 'Thinking...',
  model: 'gpt-4o',
  spinner: 'dots',
});
```

**Parameters:**

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | `'Working...'` | Initial text label |
| `spinner` | `SpinnerPreset \| string[]` | `'dots'` | Animation preset name or custom frame array |
| `interval` | `number` | `80` | Animation frame interval in milliseconds |
| `stream` | `NodeJS.WritableStream` | `process.stderr` | Output stream |
| `color` | `boolean` | auto-detected | Whether to use ANSI colors |
| `model` | `string` | `undefined` | LLM model name for automatic cost estimation |
| `pricing` | `ModelPricing` | `undefined` | Custom pricing, overrides built-in pricing table |
| `tokenBudget` | `number` | `undefined` | Maximum output tokens for budget display |
| `showModel` | `boolean` | `false` | Whether to show the model name in output |
| `showElapsed` | `boolean` | `false` | Whether to show elapsed time during streaming |
| `enabled` | `boolean` | auto-detected | Enable or disable the spinner. Auto-detects from TTY and `AI_SPINNER_ENABLED` |
| `streamingFormat` | `string` | `'{spinner} {text} {tokens} · {tps} · {cost}'` | Format template for the streaming state |
| `completeFormat` | `string` | `'{symbol} {text} · {tokens} · {elapsed} · {cost}'` | Format template for the completion state |
| `waitingFormat` | `string` | `'{spinner} {text}'` | Format template for the waiting state |
| `errorFormat` | `string` | `'{symbol} {text}'` | Format template for the error state |
| `successSymbol` | `string` | `'✓'` | Symbol displayed on success |
| `failSymbol` | `string` | `'✗'` | Symbol displayed on failure |
| `rateLimitSymbol` | `string` | `'⏳'` | Symbol displayed during rate limiting |

**Returns:** `AISpinner`

---

### `AISpinner`

The spinner instance returned by `createSpinner`. All mutation methods return `this` for chaining.

#### Properties

| Property | Type | Description |
|---|---|---|
| `text` | `string` | Get or set the current text label |
| `state` | `SpinnerState` (readonly) | Current state: `'idle'`, `'waiting'`, `'streaming'`, `'tool-calling'`, `'rate-limited'`, `'processing'`, `'complete'`, or `'error'` |
| `metrics` | `SpinnerMetrics` (readonly) | Snapshot of current metrics |
| `isActive` | `boolean` (readonly) | `true` when state is waiting, streaming, tool-calling, rate-limited, or processing |

#### `spinner.start(text?)`

Starts the spinner animation. Transitions from `idle` to `waiting`. Begins elapsed time tracking.

```typescript
spinner.start('Calling API...');
```

**Parameters:**
- `text` (optional `string`) -- Override the text label.

**Returns:** `AISpinner`

#### `spinner.stop()`

Stops the spinner animation and clears the line. Does not change the state. Use this for cleanup without printing a final message.

**Returns:** `AISpinner`

#### `spinner.reset()`

Stops the spinner, resets the state to `idle`, and clears all metrics. Allows restarting the spinner for a new operation.

```typescript
spinner.succeed('First call done');
spinner.reset();
spinner.start('Second call...');
```

**Returns:** `AISpinner`

#### `spinner.streaming(options?)`

Transitions from any active state to `streaming`. On the first call after `waiting`, records time-to-first-token (TTFT).

```typescript
spinner.streaming({ text: 'Generating...', model: 'gpt-4o', inputTokens: 1200 });
```

**Parameters:**

| Option | Type | Description |
|---|---|---|
| `text` | `string` | Override the text label |
| `model` | `string` | Set or change the model name |
| `inputTokens` | `number` | Set the input token count |

**Returns:** `AISpinner`

#### `spinner.toolCall(toolName, options?)`

Transitions from any active state to `tool-calling`. Displays the tool name with an animated spinner.

```typescript
spinner.toolCall('search_web', { index: 1, total: 3 });
// Renders: ⠋ Running search_web... (tool 1/3)
```

**Parameters:**
- `toolName` (`string`) -- Name of the tool being executed.
- `options` (optional):
  - `index` (`number`) -- Current tool call index.
  - `total` (`number`) -- Total number of tool calls.

**Returns:** `AISpinner`

#### `spinner.rateLimited(seconds, options?)`

Transitions from any active state to `rate-limited`. Starts a countdown timer that decrements every second.

```typescript
spinner.rateLimited(30, { reason: '429 Too Many Requests', statusCode: 429 });
// Renders: ⏳ Rate limited · retrying in 30s
```

**Parameters:**
- `seconds` (`number`) -- Number of seconds to count down.
- `options` (optional):
  - `reason` (`string`) -- Reason text displayed in the label.
  - `statusCode` (`number`) -- HTTP status code (stored for reference).

**Returns:** `AISpinner`

#### `spinner.processing(text?)`

Transitions from any active state to `processing`. Useful between streaming and completion for post-processing steps.

```typescript
spinner.processing('Parsing response...');
```

**Parameters:**
- `text` (optional `string`) -- Override the text label.

**Returns:** `AISpinner`

#### `spinner.succeed(text?)`

Transitions from any active state to `complete`. Stops the animation, prints a final summary line with the success symbol, and shows elapsed time and cost.

```typescript
spinner.succeed('Response generated');
// Output: ✓ Response generated · 847 tokens · 2.1s · $0.012
```

**Parameters:**
- `text` (optional `string`) -- Override the text label for the final line.

**Returns:** `AISpinner`

#### `spinner.fail(text?)`

Transitions from any active state to `error`. Stops the animation and prints a final line with the failure symbol.

```typescript
spinner.fail('API request failed');
// Output: ✗ API request failed
```

**Parameters:**
- `text` (optional `string`) -- Override the text label for the final line.

**Returns:** `AISpinner`

#### `spinner.addTokens(count?)`

Increments the output token count. Also updates the TPS calculation via a sliding window.

```typescript
spinner.addTokens(1);   // Add 1 token (default)
spinner.addTokens(10);  // Add 10 tokens at once
```

**Parameters:**
- `count` (optional `number`, default `1`) -- Number of tokens to add.

**Returns:** `AISpinner`

#### `spinner.setInputTokens(count)`

Sets the input token count (prompt tokens).

```typescript
spinner.setInputTokens(1200);
```

**Parameters:**
- `count` (`number`) -- Input token count.

**Returns:** `AISpinner`

#### `spinner.setTPS(rate)`

Manually sets the tokens-per-second rate. Overrides the auto-calculated value.

```typescript
spinner.setTPS(42.5);
```

**Parameters:**
- `rate` (`number`) -- Tokens per second.

**Returns:** `AISpinner`

#### `spinner.setCost(cost)`

Manually sets the cost in dollars. Overrides auto-calculated cost from model pricing.

```typescript
spinner.setCost(0.015);
```

**Parameters:**
- `cost` (`number`) -- Cost in dollars.

**Returns:** `AISpinner`

#### `spinner.update(metrics)`

Bulk-update multiple metrics at once.

```typescript
spinner.update({
  outputTokens: 500,
  inputTokens: 1200,
  tps: 38.2,
  cost: 0.012,
});
```

**Parameters:**
- `metrics` (`Partial<SpinnerMetrics>`) -- Any combination of `outputTokens`, `inputTokens`, `tps`, `cost`, `model`, `countdownSeconds`.

**Returns:** `AISpinner`

#### `spinner.wrapStream(stream, options?)`

Wraps an async iterable stream with automatic spinner instrumentation. The wrapped stream yields all original chunks unchanged. The spinner automatically transitions to `streaming`, counts tokens, extracts usage data, and computes TPS.

```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of spinner.wrapStream(stream)) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}

spinner.succeed('Done');
```

**Parameters:**
- `stream` (`AsyncIterable<T>`) -- The source stream to wrap.
- `options` (optional):

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | current text | Override the text label |
| `model` | `string` | current model | Set the model name |
| `inputTokens` | `number` | `undefined` | Set input token count upfront |
| `format` | `'openai' \| 'anthropic' \| 'text' \| 'auto'` | `'auto'` | Stream chunk format. `'auto'` detects from chunk structure |

**Returns:** `AsyncIterable<T>` -- The instrumented stream, yielding the same chunks as the original.

**Supported stream formats:**

- **OpenAI**: Detects `choices[].delta.content` structure. Extracts `usage.prompt_tokens` and `usage.completion_tokens` from the final chunk.
- **Anthropic**: Detects `type` field with values like `content_block_delta`, `message_start`, `message_delta`. Extracts `input_tokens` from `message_start` and `output_tokens` from `message_delta`.
- **Text**: Treats each chunk as raw text and estimates tokens from string length (1 token per 4 characters).

---

### `createPipeline(steps, options?)`

Creates and returns an `AIPipeline` instance for multi-step progress tracking.

```typescript
import { createPipeline } from 'ai-spinner';

const pipeline = createPipeline(
  [
    { name: 'Retrieving documents' },
    { name: 'Embedding chunks', total: 100 },
    { name: 'Generating response', model: 'gpt-4o' },
  ],
  { showIndex: true, showDuration: true },
);
```

**Parameters:**

`steps` -- Array of `PipelineStepConfig`:

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Step display name |
| `total` | `number` (optional) | Total items for progress display (e.g., `50/100`) |
| `model` | `string` (optional) | Model name for the step |

`options` (optional):

| Option | Type | Default | Description |
|---|---|---|---|
| `stream` | `NodeJS.WritableStream` | `process.stderr` | Output stream |
| `color` | `boolean` | auto-detected | Whether to use ANSI colors |
| `spinner` | `SpinnerPreset \| string[]` | `'dots'` | Animation preset or custom frames |
| `showIndex` | `boolean` | `true` | Show step index (e.g., `[2/5]`) |
| `showDuration` | `boolean` | `true` | Show elapsed time per step on completion |

**Returns:** `AIPipeline`

---

### `AIPipeline`

The pipeline instance returned by `createPipeline`. All mutation methods return `this` for chaining.

#### Properties

| Property | Type | Description |
|---|---|---|
| `currentStep` | `number` (readonly) | Zero-based index of the current step |
| `totalSteps` | `number` (readonly) | Total number of steps |
| `isComplete` | `boolean` (readonly) | `true` when all steps are finished or the pipeline has failed |

#### `pipeline.start()`

Begins the pipeline. Marks the first step as active and starts the render loop.

**Returns:** `AIPipeline`

#### `pipeline.next(text?)`

Marks the current step as complete and advances to the next step. If this was the last step, the pipeline completes.

**Parameters:**
- `text` (optional `string`) -- Override text for the completed step.

**Returns:** `AIPipeline`

#### `pipeline.fail(text?)`

Marks the current step as failed and stops the pipeline.

**Parameters:**
- `text` (optional `string`) -- Failure text for the current step.

**Returns:** `AIPipeline`

#### `pipeline.complete(text?)`

Marks all remaining steps as complete and stops the pipeline.

**Parameters:**
- `text` (optional `string`) -- Override text for the current step.

**Returns:** `AIPipeline`

#### `pipeline.update(data)`

Updates metrics on the current step.

```typescript
pipeline.update({ progress: 47, tokens: 200, tps: 38.2, cost: 0.003 });
```

**Parameters:**
- `data` (`PipelineUpdateData`):

| Property | Type | Description |
|---|---|---|
| `progress` | `number` | Current progress count (displayed as `progress/total`) |
| `text` | `string` | Override step status text |
| `tokens` | `number` | Token count for this step |
| `cost` | `number` | Cost for this step |
| `tps` | `number` | Tokens per second for this step |

**Returns:** `AIPipeline`

#### `pipeline.addTokens(count?)`

Adds tokens to the current step.

**Parameters:**
- `count` (optional `number`, default `1`) -- Number of tokens to add.

**Returns:** `AIPipeline`

#### `pipeline.setCost(cost)`

Sets the cost for the current step.

**Parameters:**
- `cost` (`number`) -- Cost in dollars.

**Returns:** `AIPipeline`

#### `pipeline.setTPS(rate)`

Sets the TPS for the current step.

**Parameters:**
- `rate` (`number`) -- Tokens per second.

**Returns:** `AIPipeline`

---

### Formatting Utilities

Standalone functions for formatting metric values. Useful when building custom display logic.

#### `formatTokens(n)`

Formats a token count for display. Values >= 1000 get comma separators.

```typescript
import { formatTokens } from 'ai-spinner';

formatTokens(142);      // '142 tokens'
formatTokens(12345);    // '12,345 tokens'
```

**Parameters:**
- `n` (`number`) -- Token count.

**Returns:** `string`

#### `formatTPS(rate)`

Formats a tokens-per-second rate with one decimal place.

```typescript
import { formatTPS } from 'ai-spinner';

formatTPS(38.24);  // '38.2 tok/s'
```

**Parameters:**
- `rate` (`number`) -- Tokens per second.

**Returns:** `string`

#### `formatCost(dollars)`

Formats a cost in dollars. Values below $0.01 use 3 decimal places; values at or above $0.01 use 2 decimal places.

```typescript
import { formatCost } from 'ai-spinner';

formatCost(0.003);  // '$0.003'
formatCost(1.24);   // '$1.24'
```

**Parameters:**
- `dollars` (`number`) -- Cost in dollars.

**Returns:** `string`

#### `formatElapsed(ms)`

Formats elapsed time from milliseconds. Values under 60 seconds display as `Xs` with one decimal; values at or above 60 seconds display as `Xm Ys`.

```typescript
import { formatElapsed } from 'ai-spinner';

formatElapsed(2134);   // '2.1s'
formatElapsed(72000);  // '1m 12s'
```

**Parameters:**
- `ms` (`number`) -- Elapsed time in milliseconds.

**Returns:** `string`

#### `formatCountdown(seconds)`

Formats a countdown as integer seconds.

```typescript
import { formatCountdown } from 'ai-spinner';

formatCountdown(23);  // '23s'
```

**Parameters:**
- `seconds` (`number`) -- Seconds remaining.

**Returns:** `string`

---

### Pricing Utilities

Functions for looking up model pricing and calculating costs.

#### `getModelPricing(model, customPricing?)`

Looks up pricing for a model. Custom pricing takes priority over the built-in table.

```typescript
import { getModelPricing } from 'ai-spinner';

const pricing = getModelPricing('gpt-4o');
// { inputCostPerMillion: 2.5, outputCostPerMillion: 10.0 }

const custom = getModelPricing('my-model', {
  inputCostPerMillion: 1.0,
  outputCostPerMillion: 3.0,
});
```

**Parameters:**
- `model` (`string`) -- Model name.
- `customPricing` (optional `ModelPricing`) -- Custom pricing override.

**Returns:** `ModelPricing | undefined`

#### `calculateCost(inputTokens, outputTokens, pricing)`

Calculates the dollar cost from token counts and pricing data.

```typescript
import { calculateCost, BUILT_IN_PRICING } from 'ai-spinner';

const pricing = BUILT_IN_PRICING['gpt-4o'];
const cost = calculateCost(1000, 500, pricing);
// 0.0075 ($0.0025 input + $0.005 output)
```

**Parameters:**
- `inputTokens` (`number`) -- Number of input tokens.
- `outputTokens` (`number`) -- Number of output tokens.
- `pricing` (`ModelPricing`) -- Pricing data with `inputCostPerMillion` and `outputCostPerMillion`.

**Returns:** `number` -- Cost in dollars.

#### `BUILT_IN_PRICING`

A `Record<string, ModelPricing>` containing pricing data for 14 built-in models:

| Model | Input ($/1M tokens) | Output ($/1M tokens) |
|---|---|---|
| `gpt-4o` | 2.50 | 10.00 |
| `gpt-4o-mini` | 0.15 | 0.60 |
| `gpt-4-turbo` | 10.00 | 30.00 |
| `gpt-4` | 30.00 | 60.00 |
| `gpt-3.5-turbo` | 0.50 | 1.50 |
| `o1` | 15.00 | 60.00 |
| `o1-mini` | 3.00 | 12.00 |
| `o3` | 10.00 | 40.00 |
| `o3-mini` | 1.10 | 4.40 |
| `claude-opus-4-20250514` | 15.00 | 75.00 |
| `claude-sonnet-4-20250514` | 3.00 | 15.00 |
| `claude-haiku-3-5` | 0.80 | 4.00 |
| `gemini-2.0-flash` | 0.075 | 0.30 |
| `gemini-2.0-pro` | 1.25 | 5.00 |

---

### Terminal Utilities

Functions for detecting terminal capabilities. Useful when building custom rendering logic.

#### `isTTY(stream?)`

Returns `true` if the stream is a TTY.

**Parameters:**
- `stream` (optional `NodeJS.WritableStream`)

**Returns:** `boolean`

#### `isCI()`

Returns `true` if the `CI` environment variable indicates a CI environment.

**Returns:** `boolean`

#### `supportsColor(stream?, colorOption?)`

Checks whether the stream supports ANSI colors. Priority: explicit `colorOption` > `FORCE_COLOR` > `NO_COLOR` > `TERM=dumb` > stream TTY status.

**Parameters:**
- `stream` (optional `NodeJS.WritableStream`)
- `colorOption` (optional `boolean`) -- Explicit override.

**Returns:** `boolean`

#### `getColumns(stream?)`

Returns the terminal width in columns. Falls back to 80 if not detectable.

**Parameters:**
- `stream` (optional `NodeJS.WritableStream`)

**Returns:** `number`

#### `isEnabledByEnv()`

Checks the `AI_SPINNER_ENABLED` environment variable. Returns `true` for `'1'`/`'true'`, `false` for `'0'`/`'false'`, and `undefined` if not set.

**Returns:** `boolean | undefined`

---

### Preset Utilities

#### `presets`

A `Record<SpinnerPreset, PresetData>` containing all built-in animation presets.

#### `getPreset(name)`

Returns the `PresetData` (frames and interval) for a named preset.

**Parameters:**
- `name` (`SpinnerPreset`) -- One of `'dots'`, `'line'`, `'arc'`, `'arrow'`, `'bounce'`.

**Returns:** `PresetData` -- `{ frames: string[], interval: number }`

#### `isPresetName(value)`

Type guard that checks whether a value is a valid `SpinnerPreset` name.

**Parameters:**
- `value` (`unknown`)

**Returns:** `value is SpinnerPreset`

## Configuration

### Spinner Presets

Five built-in animation presets are available:

| Preset | Frames | Interval |
|---|---|---|
| `dots` (default) | Braille dot pattern (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) | 80ms |
| `line` | Line rotation (`-\|/`) | 130ms |
| `arc` | Arc rotation (`◜◠◝◞◡◟`) | 100ms |
| `arrow` | Arrow directions (`←↖↑↗→↘↓↙`) | 120ms |
| `bounce` | Bouncing dot (`⠁⠂⠄⠂`) | 120ms |

Custom frames can be passed as a string array:

```typescript
const spinner = createSpinner({
  spinner: ['[   ]', '[-  ]', '[-- ]', '[---]', '[ --]', '[  -]'],
  interval: 100,
});
```

### Format Templates

Customize the display format for each state using template placeholders:

| Placeholder | Description |
|---|---|
| `{spinner}` | Current animation frame |
| `{symbol}` | Success/failure/rate-limit symbol |
| `{text}` | Text label |
| `{tokens}` | Output token count (or `consumed/budget` when `tokenBudget` is set) |
| `{inputTokens}` | Input token count |
| `{outputTokens}` | Output token count |
| `{tps}` | Tokens per second |
| `{cost}` | Estimated cost |
| `{elapsed}` | Elapsed time |
| `{budget}` | Token budget usage (`consumed/limit`) |
| `{model}` | Model name (when `showModel` is `true`) |
| `{ttft}` | Time to first token |
| `{tool}` | Tool name (during tool-calling state) |
| `{toolIndex}` | Tool call index (`current/total`) |
| `{countdown}` | Rate-limit countdown |

Placeholders with no value are automatically removed, and consecutive separators are collapsed.

```typescript
const spinner = createSpinner({
  streamingFormat: '{spinner} [{model}] {text} {tokens} {tps} {cost}',
  completeFormat: '{symbol} {text} ({elapsed}, {cost})',
  model: 'gpt-4o',
  showModel: true,
});
```

### Environment Variables

| Variable | Effect |
|---|---|
| `AI_SPINNER_ENABLED=1` | Force-enable the spinner regardless of TTY detection |
| `AI_SPINNER_ENABLED=0` | Force-disable the spinner |
| `NO_COLOR` | Disable all ANSI color output |
| `FORCE_COLOR=1` | Force-enable ANSI colors regardless of TTY |
| `CI=true` | Detected by `isCI()` for CI-aware behavior |

## Error Handling

### Terminal State Protection

Once a spinner reaches `complete` or `error`, calling `start()` is a no-op. The spinner must be explicitly `reset()` before it can be restarted. All state transition methods (`streaming()`, `toolCall()`, `rateLimited()`, `processing()`, `succeed()`, `fail()`) are no-ops when the spinner is not in an active state.

### Disabled Spinner

When `enabled` is `false` (or auto-detected as disabled in non-TTY environments without `AI_SPINNER_ENABLED`), all methods are safe no-ops. No output is written, no timers are started, and all method calls return `this` for chaining compatibility.

### Stream Error Propagation

`wrapStream()` does not catch errors from the underlying stream. If the source stream throws, the error propagates to the consumer. The spinner remains in its current state (typically `streaming`) and must be explicitly transitioned to `error` via `spinner.fail()`:

```typescript
spinner.start();
try {
  for await (const chunk of spinner.wrapStream(stream)) {
    process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
  }
  spinner.succeed('Done');
} catch (err) {
  spinner.fail(`Error: ${err.message}`);
}
```

### Process Cleanup

The spinner registers `exit` and `SIGINT` handlers to restore the cursor and clear the line if the process exits unexpectedly. These handlers are automatically removed when the spinner stops or finalizes.

## Advanced Usage

### Wrapping OpenAI Streams

```typescript
import OpenAI from 'openai';
import { createSpinner } from 'ai-spinner';

const openai = new OpenAI();
const spinner = createSpinner({ model: 'gpt-4o' });

spinner.start('Generating...');

const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
  stream: true,
  stream_options: { include_usage: true },
});

for await (const chunk of spinner.wrapStream(stream)) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}

spinner.succeed('Response complete');
```

### Wrapping Anthropic Streams

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createSpinner } from 'ai-spinner';

const anthropic = new Anthropic();
const spinner = createSpinner({ model: 'claude-sonnet-4-20250514' });

spinner.start('Generating...');

const stream = anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
});

for await (const event of spinner.wrapStream(stream, { format: 'anthropic' })) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}

spinner.succeed('Response complete');
```

### Rate Limit Retry Loop

```typescript
import { createSpinner } from 'ai-spinner';

const spinner = createSpinner({ model: 'gpt-4o' });

async function callWithRetry() {
  spinner.start('Calling API...');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] }),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') ?? '30', 10);
        spinner.rateLimited(retryAfter, { statusCode: 429 });
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        spinner.streaming();
        continue;
      }

      spinner.succeed('API call complete');
      return await response.json();
    } catch (err) {
      spinner.fail(`Attempt ${attempt + 1} failed`);
      throw err;
    }
  }
}
```

### Tool Call Tracking

```typescript
import { createSpinner } from 'ai-spinner';

const spinner = createSpinner({ model: 'gpt-4o' });
spinner.start('Thinking...');

const toolCalls = [
  { name: 'search_web', args: { query: 'latest news' } },
  { name: 'read_file', args: { path: '/data.json' } },
];

for (let i = 0; i < toolCalls.length; i++) {
  spinner.toolCall(toolCalls[i].name, { index: i + 1, total: toolCalls.length });
  await executeToolCall(toolCalls[i]);
}

spinner.streaming({ text: 'Generating final response...' });
// ... consume response stream ...
spinner.succeed('Done');
```

### Token Budget Tracking

```typescript
const spinner = createSpinner({
  model: 'gpt-4o',
  tokenBudget: 4096,
});

spinner.start('Generating...');
spinner.streaming();

// As tokens arrive, the display shows "142/4,096" instead of "142 tokens"
for await (const chunk of stream) {
  spinner.addTokens(1);
}

spinner.succeed('Complete');
```

### Multi-Step Pipeline

```typescript
import { createPipeline } from 'ai-spinner';

const pipeline = createPipeline([
  { name: 'Loading documents' },
  { name: 'Chunking text' },
  { name: 'Embedding chunks', total: 500 },
  { name: 'Querying vector store' },
  { name: 'Generating answer' },
]);

pipeline.start();

// Step 1: Load documents
const docs = await loadDocuments();
pipeline.next();

// Step 2: Chunk text
const chunks = chunkText(docs);
pipeline.next();

// Step 3: Embed chunks with progress
for (let i = 0; i < chunks.length; i++) {
  await embedChunk(chunks[i]);
  pipeline.update({ progress: i + 1 });
}
pipeline.next();

// Step 4: Query
const results = await queryVectorStore(query);
pipeline.next();

// Step 5: Generate with token tracking
pipeline.addTokens(200);
pipeline.setCost(0.008);
pipeline.complete('Answer generated');
```

### Custom Pricing

```typescript
import { createSpinner } from 'ai-spinner';

const spinner = createSpinner({
  model: 'my-fine-tuned-model',
  pricing: {
    inputCostPerMillion: 5.0,
    outputCostPerMillion: 15.0,
  },
});
```

### Method Chaining

All mutation methods return `this`, enabling fluent chains:

```typescript
createSpinner({ model: 'gpt-4o', stream: process.stderr, enabled: true })
  .start('Working...')
  .streaming({ inputTokens: 500 })
  .addTokens(100)
  .succeed('All done');
```

## TypeScript

The package ships with full TypeScript declarations. All public types are exported from the package root:

```typescript
import type {
  AISpinner,
  AIPipeline,
  SpinnerOptions,
  SpinnerState,
  SpinnerMetrics,
  SpinnerPreset,
  ModelPricing,
  StreamingOptions,
  ToolCallOptions,
  RateLimitOptions,
  WrapStreamOptions,
  PipelineStepConfig,
  PipelineOptions,
  PipelineUpdateData,
  PipelineStep,
  PipelineStepStatus,
  FormatOptions,
  SymbolOptions,
} from 'ai-spinner';

import type { PresetData } from 'ai-spinner';
```

The `SpinnerState` type is a string union:

```typescript
type SpinnerState =
  | 'idle'
  | 'waiting'
  | 'streaming'
  | 'tool-calling'
  | 'rate-limited'
  | 'processing'
  | 'complete'
  | 'error';
```

The `SpinnerPreset` type is a string union:

```typescript
type SpinnerPreset = 'dots' | 'line' | 'arc' | 'arrow' | 'bounce';
```

## License

MIT
