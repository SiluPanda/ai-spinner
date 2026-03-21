# ai-spinner

AI-aware terminal progress indicators with token counts, cost display, streaming throughput, and multi-step pipeline status.

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
// Output: checkmark Response generated . 847 tokens . 2.1s . $0.012
```

## Features

- AI-specific spinner states: waiting, streaming, tool-calling, rate-limited, processing
- Real-time token count, TPS, and cost display
- Built-in pricing for OpenAI, Anthropic, and Google models
- Stream wrapping for OpenAI and Anthropic APIs
- Multi-step pipeline progress
- Non-TTY fallback for CI environments
- Zero runtime dependencies

## Stream Wrapping

Wrap OpenAI or Anthropic streams for automatic token counting:

```typescript
const spinner = createSpinner({ model: 'gpt-4o' });
spinner.start('Generating...');

const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of spinner.wrapStream(stream)) {
  // Process chunks normally - spinner updates automatically
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}

spinner.succeed('Done');
```

## Rate Limiting

```typescript
spinner.start('Calling API...');

try {
  // ... API call
} catch (err) {
  if (err.status === 429) {
    spinner.rateLimited(30); // Shows countdown
    await sleep(30000);
    spinner.start('Retrying...');
  }
}
```

## Tool Calls

```typescript
spinner.start('Thinking...');
spinner.toolCall('search_web', { index: 1, total: 2 });
// Shows: spinner Running search_web... (tool 1/2)
```

## Pipeline

```typescript
import { createPipeline } from 'ai-spinner';

const pipeline = createPipeline([
  { name: 'Retrieving documents' },
  { name: 'Embedding chunks', total: 100 },
  { name: 'Generating response' },
]);

pipeline.start();

// Step 1
await retrieveDocs();
pipeline.next();

// Step 2
for (let i = 0; i < 100; i++) {
  await embedChunk(i);
  pipeline.update({ progress: i + 1 });
}
pipeline.next();

// Step 3
pipeline.addTokens(500);
pipeline.complete();
```

## API

### `createSpinner(options?)`

Creates an `AISpinner` instance.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `text` | `string` | `'Working...'` | Initial text label |
| `spinner` | `SpinnerPreset \| string[]` | `'dots'` | Animation preset or custom frames |
| `interval` | `number` | `80` | Frame interval in ms |
| `stream` | `WritableStream` | `process.stderr` | Output stream |
| `color` | `boolean` | auto | Enable ANSI colors |
| `model` | `string` | - | Model name for pricing lookup |
| `pricing` | `ModelPricing` | - | Custom pricing override |
| `tokenBudget` | `number` | - | Max output tokens for budget display |
| `enabled` | `boolean` | auto | Enable/disable spinner |

### `createPipeline(steps, options?)`

Creates an `AIPipeline` for multi-step progress.

### Spinner Presets

- `dots` - Braille dot pattern (default)
- `line` - Line rotation
- `arc` - Arc rotation
- `arrow` - Arrow directions
- `bounce` - Bouncing dot

### Built-in Model Pricing

Includes pricing for: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, `o1`, `o1-mini`, `o3`, `o3-mini`, `claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `claude-haiku-3-5`, `gemini-2.0-flash`, `gemini-2.0-pro`.

## License

MIT
