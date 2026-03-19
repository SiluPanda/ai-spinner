# ai-spinner -- Specification

## 1. Overview

`ai-spinner` is an AI-aware terminal progress indicator library that extends the familiar spinner pattern with real-time display of token counts, estimated cost, streaming throughput, and multi-step pipeline status. It provides a drop-in replacement for generic spinner libraries like `ora` that understands the specific phases and metrics of LLM API interactions -- waiting for a response, streaming tokens, handling rate limits, executing tool calls -- and renders this information live in the terminal as the operation progresses.

The gap this package fills is specific and well-defined. `ora` has 52 million weekly downloads and is the de facto standard for terminal spinners in Node.js. `cli-spinners` provides animation frame sets. `nanospinner` offers a lightweight alternative. `listr2` renders task lists. `ink` provides React-based terminal UIs. All of these are general-purpose: they display a spinner animation with a text label and optionally mark completion with a success or failure symbol. None of them understand anything about LLM operations. When a developer wraps an OpenAI streaming call in `ora`, the spinner shows `"Generating..."` for 3 seconds and then shows `"Done"`. The developer gets no feedback during those 3 seconds about what is happening: how many tokens have been generated, at what rate, at what cost, whether the model is still in prefill or actively decoding, or whether the operation hit a rate limit and is waiting to retry. This information is available -- the streaming API provides it in real time -- but no spinner library consumes it.

`ai-spinner` bridges this gap. It provides a spinner that transitions through AI-specific states (waiting, streaming, tool-calling, rate-limited, complete, error), displays AI-specific metrics (token count, tokens per second, estimated cost, token budget usage), integrates directly with LLM streaming APIs (OpenAI, Anthropic, and generic async iterables), and renders multi-step pipeline progress for chains and agents. The API is deliberately similar to `ora` -- `createSpinner()`, `spinner.start()`, `spinner.succeed()`, `spinner.fail()` -- so that migration from `ora` is trivial, but the additional methods (`spinner.streaming()`, `spinner.addTokens()`, `spinner.rateLimited()`, `spinner.toolCall()`) expose the AI-specific capabilities that `ora` cannot provide.

The result is that a developer building a CLI chatbot, a RAG pipeline runner, or a batch processing script gets terminal feedback that matches their mental model of what the LLM is doing. Instead of a generic spinning icon, they see: `Generating... 142 tokens . 38 tok/s . $0.003`. Instead of a mysterious pause, they see: `Rate limited . retrying in 23s`. Instead of a black box, they see: `[2/5] Embedding chunks... 23/100`.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `createSpinner(options?)` factory function that returns an `AISpinner` instance with an API familiar to `ora` users (`start`, `stop`, `succeed`, `fail`, `text`).
- Implement AI-specific spinner states: `idle`, `waiting`, `streaming`, `tool-calling`, `rate-limited`, `processing`, `complete`, and `error`, with well-defined transitions between them and distinct visual rendering for each state.
- Display real-time AI metrics during the `streaming` state: token count (input and output separately when available), tokens per second (TPS), estimated cost in dollars, elapsed time, and token budget usage (tokens consumed / budget limit).
- Provide a `spinner.wrapStream(stream)` method that accepts an OpenAI `Stream<ChatCompletionChunk>`, an Anthropic `MessageStream`, or any `AsyncIterable` and automatically counts tokens, computes TPS, detects time-to-first-token (TTFT), and updates the spinner display in real time, returning an instrumented stream that the caller consumes normally.
- Provide a rate limit countdown mode: when the application receives a 429 response, `spinner.rateLimited(seconds)` switches the spinner to a countdown timer display that ticks down to zero and then allows the application to retry.
- Provide a tool-calling state: `spinner.toolCall(toolName)` displays the name of the tool being executed and optionally a tool call index (e.g., "tool 2/3").
- Provide a `createPipeline(steps)` factory function that returns an `AIPipeline` instance for rendering multi-step progress through a chain of operations, with per-step status, metrics, and completion indicators.
- Handle terminal environments correctly: detect TTY for interactive spinner rendering, fall back to simple text output for non-TTY environments (CI, piped output, redirected output), detect color support and respect `NO_COLOR`, and handle terminal resize without corrupting output.
- Support configurable display formats via template strings, allowing callers to customize what metrics are shown and in what order.
- Provide model pricing data for cost estimation, with a built-in default price table for common models and the ability for callers to supply custom pricing.
- Keep dependencies minimal: zero mandatory runtime dependencies beyond Node.js built-ins.
- Target Node.js 18 and above.
- Ship complete TypeScript type definitions for all public APIs.

### Non-Goals

- **Not a terminal UI framework.** `ai-spinner` renders one or two lines of progress information. It does not provide layouts, panels, scrollable regions, or interactive input. For full terminal UIs, use `ink` or `blessed`.
- **Not an LLM client.** `ai-spinner` does not make API calls to any LLM provider. It consumes streams and metrics that the caller's LLM client produces. Bring your own OpenAI, Anthropic, or other client.
- **Not a cost tracking system.** `ai-spinner` estimates cost in real time for display purposes using a static price table. It does not persist cost data, aggregate costs across sessions, or produce cost reports. For cost tracking, use `llm-cost-per-test` or `prompt-price` from this monorepo.
- **Not a profiler.** `ai-spinner` displays progress as it happens. It does not record timing breakdowns, produce flame charts, or export trace data. For profiling, use `llm-chain-profiler` from this monorepo.
- **Not a logging library.** `ai-spinner` writes ephemeral progress to the terminal. When the spinner completes, only the final summary line persists. It does not write to log files, structured logging systems, or observability backends.
- **Not a general-purpose spinner.** While `ai-spinner` can be used as a plain spinner (call `createSpinner()` and use `start`/`succeed`/`fail`), its API surface is designed for AI operations. Developers who do not need AI-specific features should continue using `ora` or `nanospinner`.

---

## 3. Target Users and Use Cases

### CLI AI Tool Developers

Developers building command-line tools that interact with LLM APIs -- chatbots, code generation tools, question-answering systems, content generators. These tools benefit from showing the user exactly what the model is doing: how many tokens have been generated, how fast they are arriving, and how much the request is costing. Without `ai-spinner`, these tools either show a generic spinner or print raw streaming output with no progress metadata.

### RAG Pipeline and Agent Developers

Developers building retrieval-augmented generation pipelines, multi-step agents, or tool-using assistants that execute multiple sequential or nested operations. The `AIPipeline` API shows progress through the chain: `[1/5] Retrieving documents... done`, `[2/5] Embedding chunks... 47/100`, `[3/5] Generating response... 142 tokens`. This gives the developer and their users visibility into complex operations that would otherwise appear as a single long wait.

### Batch Processing Script Authors

Developers running batch LLM operations -- processing a dataset of prompts, generating embeddings for a corpus, evaluating a set of test cases. The spinner shows per-item progress and aggregate metrics, and the rate limit countdown mode handles the inevitable 429 responses gracefully by showing a countdown timer instead of crashing or silently sleeping.

### AI Development Script and Prototype Authors

Developers writing quick scripts during development -- testing prompts, experimenting with model parameters, running one-off generation tasks. The spinner provides immediate feedback about token consumption and cost, helping developers stay aware of resource usage during iterative development without needing to check provider dashboards.

### Library and Framework Authors

Developers building higher-level AI frameworks (LangChain-style chain executors, agent loops, prompt testing harnesses) who want to provide built-in progress visualization. `ai-spinner` can be used as the rendering layer that the framework drives with its own metrics, separating the progress display concern from the orchestration logic.

---

## 4. Core Concepts

### Spinner

A spinner is a terminal progress indicator that updates in place. It consists of an animated character sequence (the spinner frames, e.g., `["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]`), a text label, and optional metrics. The spinner overwrites the same terminal line on each render cycle, creating the illusion of animation. When the operation completes, the spinner is replaced by a static line showing the final result (a check mark for success, an X for failure).

### State

An `AISpinner` instance is always in exactly one state. The state determines the visual rendering (spinner frame style, prefix symbol, text template, which metrics are displayed) and the valid transitions. States are not arbitrary labels -- each state corresponds to a distinct phase of an LLM operation with specific visual and behavioral requirements.

### Metrics

Metrics are the numeric values that `ai-spinner` tracks and displays during an operation. The core metrics are:

- **Token count**: The number of tokens generated so far (output tokens). Optionally, the number of input tokens consumed by the prompt. Displayed as raw counts (e.g., `142 tokens`) or as budget usage (e.g., `142/4096 tokens`).
- **Tokens per second (TPS)**: The rate at which output tokens are arriving. Computed as a rolling average over the last 2 seconds to smooth out bursty delivery. Displayed as a number with one decimal place (e.g., `38.2 tok/s`).
- **Estimated cost**: The estimated dollar cost of the current operation, computed from token counts and model pricing. Displayed in dollars with appropriate precision (e.g., `$0.003` for small values, `$1.24` for larger values).
- **Elapsed time**: The wall-clock time since the operation started. Displayed in seconds with one decimal place for short operations (e.g., `2.1s`) or in minutes and seconds for long operations (e.g., `1m 23s`).
- **Token budget**: When a budget is configured, shows tokens consumed relative to the budget (e.g., `142/4096`). A visual progress bar or percentage can be rendered alongside.
- **Rate limit countdown**: When rate-limited, shows the number of seconds remaining before retry (e.g., `retrying in 23s`). Ticks down each second.
- **TTFT (Time To First Token)**: The elapsed time from starting the operation to receiving the first token. Not displayed during the operation (the spinner transitions from `waiting` to `streaming` at the moment of TTFT), but included in the completion summary.

### Pipeline

A pipeline is an ordered sequence of steps that execute one after another. Each step has a name, an optional status indicator, and optional per-step metrics. The pipeline renders as a vertical list of steps, with the current step showing an active spinner and completed steps showing check marks. Pipelines provide visibility into multi-step operations like RAG chains, agent loops, or batch processing workflows.

### Model Pricing

Model pricing is a lookup table mapping model names to per-token costs (input cost per million tokens and output cost per million tokens). `ai-spinner` includes a built-in price table for common models (OpenAI GPT-4o, GPT-4o-mini, GPT-4, GPT-3.5-turbo, o1, o3; Anthropic Claude Opus, Sonnet, Haiku; Google Gemini Pro, Flash) and allows callers to supply custom pricing for models not in the default table or to override default prices.

---

## 5. Spinner States

### State Machine

An `AISpinner` transitions through the following states. Each transition is triggered by a specific method call.

```
                      ┌──────────────────────────┐
                      │                          │
                      ▼                          │
  ┌──────┐  start()  ┌─────────┐  streaming()  ┌───────────┐
  │ idle │──────────▶│ waiting │─────────────▶│ streaming │
  └──────┘           └─────────┘               └───────────┘
                      │    ▲                    │    │    ▲
                      │    │                    │    │    │
           toolCall() │    │ streaming()        │    │    │ streaming()
                      ▼    │                    │    │    │
                ┌──────────────┐                │    │    │
                │ tool-calling │────────────────┘    │    │
                └──────────────┘   streaming()       │    │
                      ▲                              │    │
                      │  toolCall()                   │    │
                      └───────────────────────────────┘    │
                                                           │
                                  rateLimited()            │
                  ┌──────────────────────────────────────────┐
                  │                                          │
                  ▼            countdown expires             │
            ┌──────────────┐────────────────────────────────▶│
            │ rate-limited │                                  │
            └──────────────┘                                  │
                                                              │
                              processing()                    │
                  ┌────────────────────────────────────────────┘
                  ▼
            ┌────────────┐
            │ processing │
            └────────────┘
                  │
                  │ succeed() / fail()
                  ▼
          ┌──────────┐  ┌───────┐
          │ complete │  │ error │
          └──────────┘  └───────┘

  Notes:
  - succeed() and fail() can be called from ANY active state
    (waiting, streaming, tool-calling, rate-limited, processing).
  - stop() can be called from any state and silently clears the spinner
    without printing a final line.
```

### State: `idle`

The spinner has been created but not started. No terminal output is rendered. This is the initial state after `createSpinner()`.

**Triggered by**: `createSpinner()` (initial state).

**Valid transitions**: `start()` transitions to `waiting`.

**Display**: Nothing.

### State: `waiting`

The operation has started. The spinner is animating with a text label. The application has initiated an API call (or is about to) and is waiting for the first response data.

**Triggered by**: `spinner.start(text?)`.

**Valid transitions**:
- `streaming()` transitions to `streaming` (first token arrived or stream started).
- `toolCall(name)` transitions to `tool-calling`.
- `rateLimited(seconds)` transitions to `rate-limited`.
- `processing()` transitions to `processing`.
- `succeed(text?)` transitions to `complete`.
- `fail(text?)` transitions to `error`.

**Display**: `<spinner> <text>` where text defaults to `"Working..."` or the configured default text. Optionally shows the model name if configured.

**Examples**:
```
⠋ Calling gpt-4o...
⠙ Sending request to claude-sonnet-4-20250514...
⠹ Working...
```

### State: `streaming`

Tokens are arriving from the LLM API. This is the primary AI-specific state. The spinner displays token count, TPS, and optionally cost and budget usage. Metrics update on each render cycle (every 80ms by default).

**Triggered by**: `spinner.streaming(options?)` from `waiting`, `tool-calling`, or `rate-limited`.

**Valid transitions**:
- `toolCall(name)` transitions to `tool-calling` (model invoked a tool mid-stream).
- `rateLimited(seconds)` transitions to `rate-limited`.
- `processing()` transitions to `processing`.
- `succeed(text?)` transitions to `complete`.
- `fail(text?)` transitions to `error`.

**Display**: `<spinner> <text> <tokens> . <tps> . <cost>` where each metric component is included based on configuration and data availability.

**Examples**:
```
⠋ Generating... 142 tokens · 38.2 tok/s · $0.003
⠙ Generating... 847 tokens · 52.1 tok/s · $0.012 · 847/4096
⠹ Streaming response... 23 tokens · 15.0 tok/s
```

### State: `tool-calling`

The LLM has invoked a tool (function call) and the application is executing it. The spinner shows the tool name and optionally the tool call index within a sequence of tool calls.

**Triggered by**: `spinner.toolCall(toolName, options?)` from `waiting`, `streaming`, or another `tool-calling`.

**Valid transitions**:
- `streaming()` transitions to `streaming` (tool execution complete, model resumes generating).
- `toolCall(name)` transitions to a new `tool-calling` (next tool in a parallel tool call sequence).
- `rateLimited(seconds)` transitions to `rate-limited`.
- `processing()` transitions to `processing`.
- `succeed(text?)` transitions to `complete`.
- `fail(text?)` transitions to `error`.

**Display**: `<spinner> Running <toolName>... (tool <index>/<total>)`

**Examples**:
```
⠋ Running search_web...
⠙ Running calculate... (tool 2/3)
⠹ Executing get_weather... (tool 1/1)
```

### State: `rate-limited`

The application received a 429 (rate limit) response from the API. The spinner switches to a countdown timer showing how many seconds remain before the next retry.

**Triggered by**: `spinner.rateLimited(seconds, options?)` from any active state.

**Valid transitions**:
- Countdown reaches zero: the state does not auto-transition. The caller must explicitly call `streaming()`, `start()`, or another state method when retrying. This keeps the caller in control of retry logic.
- `streaming()` transitions to `streaming` (retry succeeded, tokens arriving).
- `start()` transitions to `waiting` (retrying the request).
- `succeed(text?)` transitions to `complete`.
- `fail(text?)` transitions to `error`.

**Display**: Uses a static symbol (hourglass) instead of the animated spinner frames, since the operation is paused.

**Examples**:
```
⏳ Rate limited · retrying in 23s
⏳ Rate limited · retrying in 1s
⏳ Rate limited (429 Too Many Requests) · retrying in 45s
```

The countdown ticks down every second automatically. The spinner's internal timer handles this; the caller does not need to manage the countdown.

### State: `processing`

Post-generation processing is underway: parsing, validation, extraction, or other computation on the completed response. This state is optional and is used when the caller wants to distinguish between "tokens are arriving" and "processing the result."

**Triggered by**: `spinner.processing(text?)` from `streaming`, `tool-calling`, or `waiting`.

**Valid transitions**:
- `succeed(text?)` transitions to `complete`.
- `fail(text?)` transitions to `error`.

**Display**: `<spinner> <text>` with a distinct color or prefix to differentiate from the `waiting` state.

**Examples**:
```
⠋ Parsing response...
⠙ Validating output schema...
⠹ Extracting entities...
```

### State: `complete`

The operation finished successfully. The spinner animation stops and is replaced by a static success symbol. A summary line shows total tokens, cost, and duration.

**Triggered by**: `spinner.succeed(text?)` from any active state.

**Valid transitions**: None. This is a terminal state. A new operation requires a new spinner or calling `spinner.reset()`.

**Display**: A single static line with a success prefix.

**Examples**:
```
✓ Done · 847 tokens · 2.1s · $0.012
✓ Response generated · 1,203 tokens (142 in / 1,061 out) · 4.8s · $0.034
✓ Complete
```

### State: `error`

The operation failed. The spinner animation stops and is replaced by a static error symbol. The error message is displayed.

**Triggered by**: `spinner.fail(text?)` from any active state.

**Valid transitions**: None. This is a terminal state.

**Display**: A single static line with an error prefix.

**Examples**:
```
✗ Error: 500 Internal Server Error
✗ Failed: Context window exceeded (128,000 tokens)
✗ Timeout after 30s
```

---

## 6. Display Formats

### Metric Components

The streaming state display is composed of configurable metric components. Each component has a default format and can be individually enabled or disabled.

| Component | Default Format | Example | When Shown |
|-----------|---------------|---------|------------|
| Token count | `<n> tokens` | `142 tokens` | Always in streaming state when tokens > 0 |
| TPS | `<n> tok/s` | `38.2 tok/s` | When TPS is computable (>= 2 tokens received) |
| Cost | `$<n>` | `$0.003` | When model pricing is available |
| Elapsed time | `<n>s` or `<m>m <s>s` | `2.1s` | Optionally, configurable |
| Token budget | `<used>/<budget>` | `142/4096` | When a token budget is configured |
| Model name | `(<model>)` | `(gpt-4o)` | When configured to show model |
| Input tokens | `<n> in` | `142 in` | In completion summary, when input tokens are known |
| Output tokens | `<n> out` | `1,061 out` | In completion summary, when output tokens are known |

Components are separated by a center dot (`·`) with spaces on both sides for readability.

### Format Templates

Callers can customize the display format using template strings with placeholders:

```typescript
const spinner = createSpinner({
  streamingFormat: '{spinner} {text} {tokens} · {tps} · {cost}',
  completeFormat: '{symbol} {text} · {tokens} · {elapsed} · {cost}',
  waitingFormat: '{spinner} {text}',
});
```

**Available placeholders**:

| Placeholder | Description |
|-------------|-------------|
| `{spinner}` | The animated spinner character |
| `{symbol}` | The final state symbol (check mark or X) |
| `{text}` | The text label |
| `{tokens}` | Token count (e.g., `142 tokens`) |
| `{inputTokens}` | Input token count (e.g., `142 in`) |
| `{outputTokens}` | Output token count (e.g., `1,061 out`) |
| `{tps}` | Tokens per second (e.g., `38.2 tok/s`) |
| `{cost}` | Estimated cost (e.g., `$0.003`) |
| `{elapsed}` | Elapsed time (e.g., `2.1s`) |
| `{budget}` | Token budget usage (e.g., `142/4096`) |
| `{model}` | Model name (e.g., `gpt-4o`) |
| `{ttft}` | Time to first token (e.g., `TTFT: 1.2s`) |
| `{tool}` | Tool name (e.g., `search_web`) |
| `{toolIndex}` | Tool call index (e.g., `2/3`) |
| `{countdown}` | Rate limit countdown (e.g., `23s`) |

Placeholders that have no value (e.g., `{cost}` when no pricing is configured) are omitted along with their surrounding separators. The renderer collapses consecutive separators to avoid `· ·` artifacts.

### Number Formatting

- **Token counts**: Comma-separated for values >= 1,000 (e.g., `1,203 tokens`). No commas for values < 1,000 (e.g., `142 tokens`).
- **TPS**: One decimal place, no comma separation (e.g., `38.2 tok/s`). Rounded to nearest 0.1. Values below 1.0 show one decimal (e.g., `0.8 tok/s`).
- **Cost**: Dollar sign prefix. Values below $0.01 show three decimal places (e.g., `$0.003`). Values between $0.01 and $1.00 show two decimal places (e.g., `$0.12`). Values above $1.00 show two decimal places (e.g., `$1.24`).
- **Elapsed time**: Values below 60 seconds show seconds with one decimal place (e.g., `2.1s`). Values at or above 60 seconds show minutes and integer seconds (e.g., `1m 23s`).
- **Countdown**: Integer seconds (e.g., `23s`).

### Color Scheme

Default ANSI color assignments (overridable via options):

| Element | Color | ANSI Code |
|---------|-------|-----------|
| Spinner frames | Cyan | `\x1b[36m` |
| Success symbol (check mark) | Green | `\x1b[32m` |
| Error symbol (X) | Red | `\x1b[31m` |
| Rate limit symbol (hourglass) | Yellow | `\x1b[33m` |
| Token count | White (default) | (none) |
| TPS | Dim | `\x1b[2m` |
| Cost | Yellow | `\x1b[33m` |
| Elapsed time | Dim | `\x1b[2m` |
| Separator (center dot) | Dim | `\x1b[2m` |
| Model name | Dim | `\x1b[2m` |

Colors are disabled when:
- `stdout` is not a TTY.
- The `NO_COLOR` environment variable is set (any value, per the `no-color.org` convention).
- The `FORCE_COLOR=0` environment variable is set.
- The caller passes `color: false` in options.

---

## 7. Real-Time Metrics

### Token Tracking

Tokens are tracked as two independent counters: `inputTokens` and `outputTokens`.

- **Input tokens**: Set once when the prompt is sent or when usage information is received from the API response. Not incremented during streaming. Passed via `spinner.streaming({ inputTokens: n })` or `spinner.update({ inputTokens: n })`.
- **Output tokens**: Incremented during streaming as tokens arrive. Updated via `spinner.addTokens(count)` on each chunk, or automatically by `spinner.wrapStream()`. Starts at 0 when streaming begins.

The display shows output tokens during streaming (this is the number growing in real time) and both input and output tokens in the completion summary.

### TPS Calculation

Tokens per second is computed as a rolling average over a sliding window to produce a stable display that does not jitter excessively on bursty streams.

**Algorithm**:

1. Maintain a circular buffer of the last N token arrival timestamps (N = 20 by default).
2. On each `addTokens(count)` call, record the current timestamp and token count.
3. TPS = (total tokens in the window) / (time span of the window in seconds).
4. If fewer than 2 data points exist, TPS is not displayed (insufficient data for a rate).
5. The display updates on each render cycle (every 80ms), using the most recently computed TPS.

This sliding window approach produces smooth TPS values that reflect recent throughput without lagging excessively or spiking on individual large chunks.

### Cost Estimation

Cost is estimated from token counts and model pricing:

```
cost = (inputTokens * inputPricePerMillion / 1_000_000)
     + (outputTokens * outputPricePerMillion / 1_000_000)
```

The cost display updates on each render cycle as `outputTokens` grows.

Cost is only displayed when both conditions are met:
1. A model name is configured (`options.model` or `spinner.streaming({ model })` or via `wrapStream`).
2. Pricing for that model exists in the built-in table or was provided via `options.pricing`.

When pricing is not available, the cost component is silently omitted from the display.

### Built-In Model Pricing

The default price table (input/output cost per million tokens):

| Model | Input $/M | Output $/M |
|-------|----------|-----------|
| `gpt-4o` | $2.50 | $10.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4` | $30.00 | $60.00 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |
| `o1` | $15.00 | $60.00 |
| `o1-mini` | $3.00 | $12.00 |
| `o3` | $10.00 | $40.00 |
| `o3-mini` | $1.10 | $4.40 |
| `claude-opus-4-20250514` | $15.00 | $75.00 |
| `claude-sonnet-4-20250514` | $3.00 | $15.00 |
| `claude-haiku-3-5` | $0.80 | $4.00 |
| `gemini-2.0-flash` | $0.075 | $0.30 |
| `gemini-2.0-pro` | $1.25 | $5.00 |

This table is a best-effort snapshot. Prices change over time. Callers needing accurate, current pricing should provide custom pricing via options or integrate with `model-price-registry` from this monorepo.

### Token Budget

When the caller configures a token budget (maximum output tokens), the display shows usage as a fraction:

```typescript
const spinner = createSpinner({ tokenBudget: 4096 });
```

Display: `142/4096 tokens` or `142/4096` depending on format template.

The budget is purely informational -- `ai-spinner` does not enforce the budget or stop generation. It provides visual feedback so the user can see how much of the allowed output has been consumed.

### TTFT Tracking

Time to first token is measured internally when the spinner transitions from `waiting` to `streaming`. The TTFT value is:

```
ttft = timestamp_of_streaming_transition - timestamp_of_start
```

TTFT is not displayed during the operation (the transition itself is the TTFT event -- the spinner switches from "Calling..." to "Generating... 1 token"). TTFT is included in the completion summary when `spinner.succeed()` is called, if the `completeFormat` includes `{ttft}`.

When using `spinner.wrapStream()`, TTFT is automatically measured from the moment `wrapStream` is called to the moment the first non-empty chunk arrives.

---

## 8. Multi-Step Pipeline

### Pipeline Concept

An `AIPipeline` renders a vertical list of steps, each with its own status. Only one step is active at a time. Completed steps show a check mark. Future steps show a dim dash. The active step shows an animated spinner with optional metrics.

```
✓ Retrieving documents... done (0.3s)
✓ Embedding chunks... done (1.2s)
⠋ Generating response... 142 tokens · 38.2 tok/s
─ Validating output...
─ Formatting result...
```

### Pipeline API

```typescript
const pipeline = createPipeline([
  { name: 'Retrieving documents' },
  { name: 'Embedding chunks', total: 100 },  // total enables progress count
  { name: 'Generating response' },
  { name: 'Validating output' },
  { name: 'Formatting result' },
]);

pipeline.start();  // starts the first step

// ... do retrieval work ...
pipeline.next();  // marks step 1 complete, starts step 2

// During step 2, update progress:
pipeline.update({ progress: 47 });  // shows "47/100"

// ... do embedding work ...
pipeline.next();  // marks step 2 complete, starts step 3

// During step 3, use AI spinner features:
pipeline.addTokens(10);
pipeline.setCost(0.003);

// ... do generation work ...
pipeline.next();  // marks step 3 complete, starts step 4

// ... continue through remaining steps ...
pipeline.complete();  // marks all remaining steps done
```

### Step Display Format

Each step in the pipeline is rendered as a line:

```
<prefix> [<index>/<total>] <name>... <status> (<metrics>)
```

Where:
- `<prefix>` is `✓` (complete), `<spinner>` (active), `✗` (failed), or `─` (pending).
- `[<index>/<total>]` is the step number and total step count.
- `<name>` is the step name from the configuration.
- `<status>` is `done`, a progress indicator, an AI metric string, or empty.
- `<metrics>` includes duration for completed steps, progress counts for steps with a `total`, and AI metrics (tokens, TPS, cost) for the active step if configured.

### Step Metrics

Each pipeline step tracks its own independent metrics:

- **Duration**: Wall-clock time from step start to step completion. Shown next to completed steps.
- **Progress**: For steps with a `total` configured (e.g., "Embedding 100 chunks"), the current progress count. Updated via `pipeline.update({ progress: n })`. Displayed as `<current>/<total>`.
- **AI metrics**: The active step can display token count, TPS, and cost using the same mechanics as a standalone spinner. The pipeline proxies `addTokens()`, `setCost()`, `setTPS()` calls to the active step's metrics.

### Nested Pipelines

Pipelines do not support nesting in v1. Each pipeline is a flat list of sequential steps. For deeply nested operations, use multiple independent pipelines or a single pipeline with appropriately named steps that reflect the logical hierarchy (e.g., "RAG > Retrieve", "RAG > Generate").

### Terminal Rendering for Pipelines

Pipelines require multi-line cursor manipulation. The pipeline renderer:

1. On first render, prints all step lines (one per step).
2. On subsequent renders, moves the cursor up to the active step's line and rewrites it in place.
3. When a step completes and the next step begins, the completed step's line is updated to its final form and the cursor moves down.

This approach uses ANSI escape codes for cursor movement (`\x1b[<n>A` to move up, `\x1b[2K` to clear a line). In non-TTY environments, each step's completion is printed as a separate line with no cursor manipulation:

```
[1/5] Retrieving documents... done (0.3s)
[2/5] Embedding chunks... done (1.2s)
[3/5] Generating response... done (847 tokens, 2.1s, $0.012)
[4/5] Validating output... done (0.1s)
[5/5] Formatting result... done (0.05s)
```

---

## 9. API Surface

### Installation

```bash
npm install ai-spinner
```

### Core Exports

```typescript
import {
  createSpinner,
  createPipeline,
} from 'ai-spinner';
```

### `createSpinner(options?)`

Factory function that creates an `AISpinner` instance.

```typescript
function createSpinner(options?: SpinnerOptions): AISpinner;
```

**Options**:

```typescript
interface SpinnerOptions {
  /**
   * Initial text label for the spinner.
   * Default: 'Working...'.
   */
  text?: string;

  /**
   * Spinner animation frames. Can be a named preset (e.g., 'dots', 'line', 'arc')
   * or a custom array of frame strings.
   * Default: 'dots' (the Braille dot pattern: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏).
   */
  spinner?: SpinnerPreset | string[];

  /**
   * Animation frame interval in milliseconds.
   * Controls how frequently the spinner frame advances and the display re-renders.
   * Default: 80.
   */
  interval?: number;

  /**
   * Output stream for spinner rendering.
   * Default: process.stderr (standard practice for progress indicators;
   * stdout is reserved for program output).
   */
  stream?: NodeJS.WritableStream;

  /**
   * Whether to use ANSI colors.
   * Default: auto-detected from TTY status and NO_COLOR env var.
   */
  color?: boolean;

  /**
   * The LLM model name (e.g., 'gpt-4o', 'claude-sonnet-4-20250514').
   * Used for cost estimation (pricing lookup) and optional display.
   * Default: undefined (no cost estimation, no model display).
   */
  model?: string;

  /**
   * Custom model pricing. Overrides built-in pricing for the specified model.
   * If the model is not in the built-in table and no custom pricing is provided,
   * cost estimation is disabled.
   */
  pricing?: ModelPricing;

  /**
   * Maximum output tokens (token budget).
   * When set, the streaming display shows token usage as a fraction (e.g., 142/4096).
   * Default: undefined (no budget display).
   */
  tokenBudget?: number;

  /**
   * Format template for the streaming state.
   * Default: '{spinner} {text} {tokens} · {tps} · {cost}'.
   */
  streamingFormat?: string;

  /**
   * Format template for the completion state (succeed).
   * Default: '{symbol} {text} · {tokens} · {elapsed} · {cost}'.
   */
  completeFormat?: string;

  /**
   * Format template for the waiting state.
   * Default: '{spinner} {text}'.
   */
  waitingFormat?: string;

  /**
   * Format template for the error state (fail).
   * Default: '{symbol} {text}'.
   */
  errorFormat?: string;

  /**
   * Whether to show the model name in the spinner display.
   * Default: false.
   */
  showModel?: boolean;

  /**
   * Whether to show elapsed time during streaming.
   * Default: false (elapsed time is shown only in the completion summary).
   */
  showElapsed?: boolean;

  /**
   * Symbol for the success state.
   * Default: '✓'.
   */
  successSymbol?: string;

  /**
   * Symbol for the error state.
   * Default: '✗'.
   */
  failSymbol?: string;

  /**
   * Symbol for the rate-limited state.
   * Default: '⏳'.
   */
  rateLimitSymbol?: string;

  /**
   * Whether the spinner is enabled. When false, all methods are no-ops.
   * Useful for disabling spinners in test environments or when stdout is captured.
   * Default: true when stderr is a TTY, false otherwise.
   */
  enabled?: boolean;
}

type SpinnerPreset = 'dots' | 'line' | 'arc' | 'arrow' | 'bounce';

interface ModelPricing {
  /** Cost per million input tokens in dollars. */
  inputCostPerMillion: number;

  /** Cost per million output tokens in dollars. */
  outputCostPerMillion: number;
}
```

### `AISpinner` Interface

```typescript
interface AISpinner {
  // ── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Starts the spinner in the 'waiting' state.
   * Begins the render loop and displays the spinner animation with the text label.
   *
   * @param text - Optional text to override the configured text.
   * @returns this (for chaining).
   */
  start(text?: string): AISpinner;

  /**
   * Stops the spinner without printing a final line.
   * Clears the current spinner line from the terminal.
   * Use succeed() or fail() for a final status line.
   *
   * @returns this (for chaining).
   */
  stop(): AISpinner;

  /**
   * Resets the spinner to the 'idle' state, clearing all metrics.
   * Allows reuse of the same spinner instance for a new operation.
   *
   * @returns this (for chaining).
   */
  reset(): AISpinner;

  // ── State Transitions ─────────────────────────────────────────────

  /**
   * Transitions to the 'streaming' state.
   * Call this when the first token arrives or when streaming begins.
   * Subsequent calls update the streaming options without re-triggering
   * TTFT measurement.
   *
   * @param options - Optional streaming configuration.
   * @returns this (for chaining).
   */
  streaming(options?: StreamingOptions): AISpinner;

  /**
   * Transitions to the 'tool-calling' state.
   * Call this when the model invokes a tool.
   *
   * @param toolName - The name of the tool being called.
   * @param options - Optional tool call metadata.
   * @returns this (for chaining).
   */
  toolCall(toolName: string, options?: ToolCallOptions): AISpinner;

  /**
   * Transitions to the 'rate-limited' state with a countdown timer.
   * The countdown ticks down automatically each second.
   * Call start() or streaming() when the retry begins.
   *
   * @param seconds - Number of seconds until retry.
   * @param options - Optional rate limit metadata.
   * @returns this (for chaining).
   */
  rateLimited(seconds: number, options?: RateLimitOptions): AISpinner;

  /**
   * Transitions to the 'processing' state.
   * Call this when post-generation processing begins.
   *
   * @param text - Optional text describing the processing step.
   * @returns this (for chaining).
   */
  processing(text?: string): AISpinner;

  /**
   * Transitions to the 'complete' state with a success symbol.
   * Stops the render loop and prints the final summary line.
   *
   * @param text - Optional text for the summary line. If omitted,
   *   a default summary is generated from the accumulated metrics.
   * @returns this (for chaining).
   */
  succeed(text?: string): AISpinner;

  /**
   * Transitions to the 'error' state with an error symbol.
   * Stops the render loop and prints the final error line.
   *
   * @param text - Optional error message. If omitted, shows 'Failed'.
   * @returns this (for chaining).
   */
  fail(text?: string): AISpinner;

  // ── Metric Updates ────────────────────────────────────────────────

  /**
   * Adds tokens to the output token count.
   * Call this on each streaming chunk with the number of tokens in the chunk.
   * TPS is automatically recalculated.
   *
   * @param count - Number of tokens to add. Default: 1.
   * @returns this (for chaining).
   */
  addTokens(count?: number): AISpinner;

  /**
   * Sets the input token count.
   * Typically called once when usage information is available.
   *
   * @param count - Number of input tokens.
   * @returns this (for chaining).
   */
  setInputTokens(count: number): AISpinner;

  /**
   * Manually sets the TPS value, overriding the auto-calculated value.
   * Use this when you have a more accurate TPS measurement from the API.
   *
   * @param rate - Tokens per second.
   * @returns this (for chaining).
   */
  setTPS(rate: number): AISpinner;

  /**
   * Manually sets the cost value, overriding the auto-calculated value.
   * Use this when you have a more accurate cost from the API response.
   *
   * @param cost - Cost in dollars.
   * @returns this (for chaining).
   */
  setCost(cost: number): AISpinner;

  /**
   * Bulk-updates multiple metrics at once.
   * More efficient than calling individual setters for each metric.
   *
   * @param metrics - Partial metrics object.
   * @returns this (for chaining).
   */
  update(metrics: Partial<SpinnerMetrics>): AISpinner;

  // ── Stream Integration ────────────────────────────────────────────

  /**
   * Wraps an LLM stream with automatic token counting and spinner updates.
   * Returns an instrumented stream that the caller consumes normally.
   *
   * The spinner automatically:
   * - Transitions to 'streaming' on the first chunk.
   * - Calls addTokens() on each chunk.
   * - Measures TTFT.
   * - Extracts token counts from usage fields when available.
   * - Does NOT call succeed() or fail() on stream close/error.
   *   The caller must call those explicitly after consuming the stream.
   *
   * @param stream - An OpenAI Stream, Anthropic MessageStream, or AsyncIterable.
   * @param options - Optional stream wrapping configuration.
   * @returns The same stream type, instrumented with spinner updates.
   */
  wrapStream<T extends AsyncIterable<unknown>>(
    stream: T,
    options?: WrapStreamOptions,
  ): T;

  // ── Properties ────────────────────────────────────────────────────

  /**
   * The current spinner text label.
   * Can be set to update the display text without changing state.
   */
  text: string;

  /**
   * The current spinner state.
   * Read-only.
   */
  readonly state: SpinnerState;

  /**
   * The current accumulated metrics.
   * Read-only.
   */
  readonly metrics: Readonly<SpinnerMetrics>;

  /**
   * Whether the spinner is currently active (rendering to the terminal).
   * Read-only.
   */
  readonly isActive: boolean;
}
```

### Supporting Types

```typescript
type SpinnerState =
  | 'idle'
  | 'waiting'
  | 'streaming'
  | 'tool-calling'
  | 'rate-limited'
  | 'processing'
  | 'complete'
  | 'error'
  ;

interface SpinnerMetrics {
  /** Number of output tokens generated so far. */
  outputTokens: number;

  /** Number of input tokens (prompt tokens). */
  inputTokens: number;

  /** Tokens per second (rolling average). */
  tps: number;

  /** Estimated cost in dollars. */
  cost: number;

  /** Elapsed time in milliseconds since start(). */
  elapsedMs: number;

  /** Time to first token in milliseconds. Undefined until streaming begins. */
  ttftMs?: number;

  /** Model name, if configured. */
  model?: string;

  /** Rate limit countdown remaining seconds. Undefined when not rate-limited. */
  countdownSeconds?: number;
}

interface StreamingOptions {
  /** Text label to display during streaming. Default: 'Generating...'. */
  text?: string;

  /** Model name (overrides spinner-level model). */
  model?: string;

  /** Number of input tokens (for cost calculation and display). */
  inputTokens?: number;
}

interface ToolCallOptions {
  /** Index of this tool call within a sequence (1-based). */
  index?: number;

  /** Total number of tool calls in the sequence. */
  total?: number;
}

interface RateLimitOptions {
  /** Human-readable reason for the rate limit. */
  reason?: string;

  /** HTTP status code (typically 429). */
  statusCode?: number;
}

interface WrapStreamOptions {
  /** Text label to display during streaming. */
  text?: string;

  /** Model name for cost estimation. */
  model?: string;

  /** Number of input tokens. */
  inputTokens?: number;

  /**
   * Stream format hint. Determines how chunks are parsed for token counting.
   * 'openai': expects OpenAI ChatCompletionChunk format.
   * 'anthropic': expects Anthropic MessageStreamEvent format.
   * 'text': treats each chunk as a text string, counts words/4 as token estimate.
   * 'auto': attempts to detect the format from the first chunk.
   * Default: 'auto'.
   */
  format?: 'openai' | 'anthropic' | 'text' | 'auto';
}
```

### `createPipeline(steps, options?)`

Factory function that creates an `AIPipeline` instance.

```typescript
function createPipeline(
  steps: PipelineStepConfig[],
  options?: PipelineOptions,
): AIPipeline;
```

**Types**:

```typescript
interface PipelineStepConfig {
  /** Display name of the step. */
  name: string;

  /**
   * Total count for progress display (e.g., number of chunks to embed).
   * When set, the step shows progress as "current/total".
   */
  total?: number;
}

interface PipelineOptions {
  /**
   * Output stream.
   * Default: process.stderr.
   */
  stream?: NodeJS.WritableStream;

  /**
   * Whether to use ANSI colors.
   * Default: auto-detected.
   */
  color?: boolean;

  /**
   * Spinner options for the active step.
   * These are passed to the internal AISpinner for the current step.
   */
  spinner?: Omit<SpinnerOptions, 'stream' | 'color'>;

  /**
   * Whether to show step indices (e.g., [1/5]).
   * Default: true.
   */
  showIndex?: boolean;

  /**
   * Whether to show duration for completed steps.
   * Default: true.
   */
  showDuration?: boolean;
}
```

### `AIPipeline` Interface

```typescript
interface AIPipeline {
  /**
   * Starts the pipeline. Begins the first step.
   *
   * @returns this (for chaining).
   */
  start(): AIPipeline;

  /**
   * Marks the current step as complete and advances to the next step.
   * If there are no more steps, the pipeline enters the complete state.
   *
   * @param text - Optional completion text for the current step.
   * @returns this (for chaining).
   */
  next(text?: string): AIPipeline;

  /**
   * Marks the current step as failed and stops the pipeline.
   *
   * @param text - Optional error text for the failed step.
   * @returns this (for chaining).
   */
  fail(text?: string): AIPipeline;

  /**
   * Marks all remaining steps as complete and stops the pipeline.
   *
   * @returns this (for chaining).
   */
  complete(): AIPipeline;

  /**
   * Updates the current step's metrics or progress.
   *
   * @param data - Metrics and progress data for the current step.
   * @returns this (for chaining).
   */
  update(data: PipelineUpdateData): AIPipeline;

  /**
   * Adds tokens to the current step's token count.
   * Proxied to the internal spinner for the active step.
   *
   * @param count - Number of tokens to add.
   * @returns this (for chaining).
   */
  addTokens(count?: number): AIPipeline;

  /**
   * Sets the cost for the current step.
   *
   * @param cost - Cost in dollars.
   * @returns this (for chaining).
   */
  setCost(cost: number): AIPipeline;

  /**
   * Sets the TPS for the current step.
   *
   * @param rate - Tokens per second.
   * @returns this (for chaining).
   */
  setTPS(rate: number): AIPipeline;

  /**
   * The index of the currently active step (0-based).
   * Read-only.
   */
  readonly currentStep: number;

  /**
   * The total number of steps.
   * Read-only.
   */
  readonly totalSteps: number;

  /**
   * Whether the pipeline is complete (all steps done or failed).
   * Read-only.
   */
  readonly isComplete: boolean;
}

interface PipelineUpdateData {
  /** Progress count for the current step (used with step's total). */
  progress?: number;

  /** Text label for the current step. */
  text?: string;

  /** Token count to set (not add). */
  tokens?: number;

  /** Cost in dollars. */
  cost?: number;

  /** Tokens per second. */
  tps?: number;
}
```

---

## 10. Streaming Integration

### `wrapStream` Architecture

The `wrapStream` method accepts a stream, wraps it in an async generator that observes chunks without buffering them, and returns the wrapped stream. The caller consumes the returned stream identically to the original. The wrapper:

1. Records `t_start = performance.now()` when `wrapStream` is called.
2. On the first chunk: transitions the spinner from `waiting` to `streaming`, computes TTFT = `performance.now() - t_start`, and records it in the spinner's metrics.
3. On each chunk: extracts token information based on the stream format, calls `addTokens()` to update the spinner display.
4. On stream end: does nothing (the caller is responsible for calling `succeed()` or `fail()`). This design keeps the caller in control: the stream might end successfully but the caller may want to run validation before calling `succeed()`.
5. On stream error: does nothing (same rationale). The caller catches the error, may retry, and calls `fail()` when appropriate.

### OpenAI Stream Adapter

For OpenAI streams (`Stream<ChatCompletionChunk>` from `openai.chat.completions.create({ stream: true })`):

```typescript
// Internal implementation sketch
async function* wrapOpenAIStream(
  stream: AsyncIterable<ChatCompletionChunk>,
  spinner: AISpinner,
  startTime: number,
): AsyncIterable<ChatCompletionChunk> {
  let firstChunk = true;

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;

    if (firstChunk && content) {
      spinner.streaming();
      firstChunk = false;
    }

    if (content) {
      // OpenAI streams deliver approximately one token per chunk in most cases.
      // For accurate counts, we check the usage field on the final chunk.
      spinner.addTokens(1);
    }

    // Final chunk with usage data (when stream_options.include_usage is true)
    if (chunk.usage) {
      spinner.setInputTokens(chunk.usage.prompt_tokens);
      // Correct the output token count with the authoritative value
      spinner.update({ outputTokens: chunk.usage.completion_tokens });
    }

    yield chunk;
  }
}
```

Token counting in OpenAI streams: each chunk typically contains one token in the `delta.content` field. The wrapper counts each non-empty content chunk as one token. If the stream includes a final usage chunk (enabled by `stream_options: { include_usage: true }` in the API call), the wrapper uses the authoritative `completion_tokens` value from that chunk to correct the running count. This means the token count during streaming is approximate (one token per chunk) and becomes exact at stream completion when usage data is available.

### Anthropic Stream Adapter

For Anthropic streams (`MessageStream` from `anthropic.messages.stream()` or the raw event stream):

```typescript
// Internal implementation sketch
async function* wrapAnthropicStream(
  stream: AsyncIterable<MessageStreamEvent>,
  spinner: AISpinner,
  startTime: number,
): AsyncIterable<MessageStreamEvent> {
  let firstText = true;

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      if (firstText) {
        spinner.streaming();
        firstText = false;
      }
      // Anthropic text deltas contain variable-length text.
      // Estimate token count as ceil(text.length / 4).
      const estimatedTokens = Math.max(1, Math.ceil(event.delta.text.length / 4));
      spinner.addTokens(estimatedTokens);
    }

    // Message start event contains input token usage
    if (event.type === 'message_start' && event.message.usage) {
      spinner.setInputTokens(event.message.usage.input_tokens);
    }

    // Message delta event at the end contains output token usage
    if (event.type === 'message_delta' && event.usage) {
      spinner.update({ outputTokens: event.usage.output_tokens });
    }

    yield event;
  }
}
```

Token counting in Anthropic streams: `content_block_delta` events contain variable-length text fragments that may span multiple tokens. The wrapper estimates tokens as `ceil(text.length / 4)` (a rough approximation based on the average English token length of ~4 characters). The authoritative output token count from the `message_delta` event's `usage` field corrects this estimate at stream completion.

### Generic AsyncIterable Adapter

For streams that are not recognized as OpenAI or Anthropic format, the wrapper treats each chunk as a string (calling `String(chunk)` if necessary) and estimates tokens as `ceil(text.length / 4)`:

```typescript
async function* wrapGenericStream(
  stream: AsyncIterable<unknown>,
  spinner: AISpinner,
  startTime: number,
): AsyncIterable<unknown> {
  let firstChunk = true;

  for await (const chunk of stream) {
    if (firstChunk) {
      spinner.streaming();
      firstChunk = false;
    }

    const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
    const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
    spinner.addTokens(estimatedTokens);

    yield chunk;
  }
}
```

### Auto-Detection

When `format: 'auto'` (the default), the wrapper inspects the first chunk to determine the stream format:

1. If the chunk has a `choices` array with a `delta` property: treat as OpenAI format.
2. If the chunk has a `type` property matching Anthropic event types (`message_start`, `content_block_delta`, `message_delta`): treat as Anthropic format.
3. Otherwise: treat as generic text format.

The format is determined from the first chunk and applied to all subsequent chunks. This detection adds no overhead beyond a single property check on the first iteration.

---

## 11. Terminal Handling

### TTY Detection

`ai-spinner` checks whether the output stream is a TTY before enabling interactive rendering:

```typescript
const isTTY = stream.isTTY === true;
```

When the output stream is not a TTY (piped to a file, running in CI without a pseudo-terminal, redirected to another process), the spinner:

- Does not render animated frames.
- Does not use cursor movement escape codes.
- Does not use ANSI color codes.
- Prints a single line when the operation starts (the initial text label).
- Prints a single line when the operation completes (the summary).
- Does not print intermediate updates.

This ensures clean output in CI logs and piped output without interleaved escape codes.

### CI Environment Detection

In addition to TTY detection, `ai-spinner` detects CI environments via the `CI` environment variable (set by GitHub Actions, GitLab CI, CircleCI, Jenkins, and most CI systems). When `CI=true` and the stream is not a TTY, the spinner falls back to simple text output regardless of other settings.

### Color Support Detection

Color support is detected in this priority order:

1. `options.color` explicitly set: use that value.
2. `FORCE_COLOR` environment variable set to `0`: disable color.
3. `FORCE_COLOR` environment variable set to `1`, `2`, or `3`: enable color.
4. `NO_COLOR` environment variable set (any value): disable color.
5. `stream.isTTY` is true and `stream.hasColors()` returns true (Node.js 20+): enable color.
6. `stream.isTTY` is true: enable color (assume basic color support).
7. Otherwise: disable color.

### Cursor Management

The spinner uses these ANSI escape sequences for cursor management:

- `\x1b[?25l`: Hide cursor (on start).
- `\x1b[?25h`: Show cursor (on stop/succeed/fail and in the process exit handler).
- `\r`: Move cursor to the beginning of the current line.
- `\x1b[2K`: Clear the current line.
- `\x1b[<n>A`: Move cursor up n lines (for pipeline rendering).
- `\x1b[<n>B`: Move cursor down n lines (for pipeline rendering).

### Graceful Cleanup

The spinner registers handlers for `process.on('exit')` and `process.on('SIGINT')` to ensure the cursor is restored if the process terminates while the spinner is active. Without this, a Ctrl+C during an active spinner would leave the cursor hidden.

The cleanup handler:
1. Clears the current spinner line.
2. Shows the cursor (`\x1b[?25h`).
3. Removes its own listeners to avoid accumulation across multiple spinner instances.

### Window Resize

The spinner truncates its output to fit within the terminal width. On each render cycle, it checks `stream.columns` (the current terminal width) and truncates the rendered line with an ellipsis if it exceeds the available width. This prevents line wrapping that would corrupt the in-place update rendering.

For pipeline rendering, terminal width affects the per-step line formatting but does not change the number of lines rendered.

### Multiple Concurrent Spinners

`ai-spinner` does not natively support multiple spinners rendering simultaneously on separate lines. Running two `AISpinner` instances concurrently on the same output stream will produce corrupted output because both spinners attempt to overwrite the same line.

For multiple concurrent operations, use `AIPipeline` (which manages multi-line rendering internally) or serialize spinner usage (stop one before starting another).

---

## 12. Configuration

### All Options with Defaults

```typescript
const defaults: SpinnerOptions = {
  text: 'Working...',
  spinner: 'dots',
  interval: 80,
  stream: process.stderr,
  color: undefined,               // auto-detected
  model: undefined,               // no cost estimation
  pricing: undefined,             // use built-in table
  tokenBudget: undefined,         // no budget display
  streamingFormat: '{spinner} {text} {tokens} · {tps} · {cost}',
  completeFormat: '{symbol} {text} · {tokens} · {elapsed} · {cost}',
  waitingFormat: '{spinner} {text}',
  errorFormat: '{symbol} {text}',
  showModel: false,
  showElapsed: false,
  successSymbol: '✓',
  failSymbol: '✗',
  rateLimitSymbol: '⏳',
  enabled: undefined,             // auto-detected from TTY
};
```

### Spinner Presets

| Preset | Frames | Interval |
|--------|--------|----------|
| `dots` | `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` | 80ms |
| `line` | `- \ \| /` | 130ms |
| `arc` | `◜ ◠ ◝ ◞ ◡ ◟` | 100ms |
| `arrow` | `← ↖ ↑ ↗ → ↘ ↓ ↙` | 120ms |
| `bounce` | `⠁ ⠂ ⠄ ⠂` | 120ms |

When a custom `interval` is specified alongside a preset, the custom interval overrides the preset's default interval.

### Environment Variables

| Variable | Purpose | Values |
|----------|---------|--------|
| `NO_COLOR` | Disable ANSI color output | Any value (standard convention) |
| `FORCE_COLOR` | Force color output even in non-TTY | `0` (disable), `1`, `2`, `3` (enable) |
| `CI` | CI environment detection | `true` (standard convention) |
| `AI_SPINNER_ENABLED` | Force-enable or force-disable spinners | `true`, `false`, `1`, `0` |

Environment variables take lower priority than explicit `options` values. `AI_SPINNER_ENABLED` is checked only if `options.enabled` is not explicitly set.

---

## 13. Integration with the npm-master Ecosystem

### llm-chain-profiler

`llm-chain-profiler` instruments LLM chains to produce timing breakdowns after execution. `ai-spinner` provides real-time visual progress during execution. They complement each other: `ai-spinner` shows the user what is happening now; `llm-chain-profiler` shows the developer where the time went after the fact.

They can be composed in the same application. The profiler instruments the client to record timing spans; the spinner wraps the stream to display progress. Both can wrap the same stream (profiler as the outer wrapper, spinner as the inner):

```typescript
import { createProfiler } from 'llm-chain-profiler';
import { createSpinner } from 'ai-spinner';

const profiler = createProfiler();
const spinner = createSpinner({ model: 'gpt-4o' });
const openai = profiler.instrument(new OpenAI());

spinner.start('Generating...');
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
  stream: true,
});

const instrumented = spinner.wrapStream(stream);
let text = '';
for await (const chunk of instrumented) {
  text += chunk.choices[0]?.delta?.content ?? '';
}
spinner.succeed();
profiler.report();
```

### prompt-price / model-price-registry

`prompt-price` and `model-price-registry` provide model pricing data. `ai-spinner`'s built-in price table is a convenience snapshot; for production accuracy, callers can query `model-price-registry` for current prices and pass them to `ai-spinner` via the `pricing` option:

```typescript
import { getModelPrice } from 'model-price-registry';
import { createSpinner } from 'ai-spinner';

const price = await getModelPrice('gpt-4o');
const spinner = createSpinner({
  model: 'gpt-4o',
  pricing: {
    inputCostPerMillion: price.inputPerMillion,
    outputCostPerMillion: price.outputPerMillion,
  },
});
```

### llm-cost-per-test

`llm-cost-per-test` tracks per-test LLM costs for test suites. In test environments, `ai-spinner` is typically disabled (`enabled: false` or auto-disabled because test runners do not provide a TTY). The cost tracking from `llm-cost-per-test` operates at the API call level and is unaffected by spinner presence.

---

## 14. Testing Strategy

### Unit Tests

**Spinner state machine tests**:
- `createSpinner()` returns a spinner in the `idle` state.
- `spinner.start()` transitions to `waiting`; `spinner.state` is `'waiting'`.
- `spinner.streaming()` from `waiting` transitions to `streaming`.
- `spinner.toolCall('search')` from `waiting` transitions to `tool-calling`.
- `spinner.toolCall('search')` from `streaming` transitions to `tool-calling`.
- `spinner.rateLimited(30)` from any active state transitions to `rate-limited`.
- `spinner.processing()` from `streaming` transitions to `processing`.
- `spinner.succeed()` from any active state transitions to `complete`.
- `spinner.fail()` from any active state transitions to `error`.
- `spinner.start()` from `idle` works; `spinner.start()` from `complete` does not transition (terminal state unless `reset()` is called first).
- `spinner.reset()` from `complete` resets to `idle` with cleared metrics.

**Metric tracking tests**:
- `spinner.addTokens(5)`: `metrics.outputTokens` increments by 5.
- `spinner.addTokens()` (no argument): `metrics.outputTokens` increments by 1.
- `spinner.setInputTokens(100)`: `metrics.inputTokens` is 100.
- `spinner.setCost(0.005)`: `metrics.cost` is 0.005.
- `spinner.setTPS(42.5)`: `metrics.tps` is 42.5.
- `spinner.update({ outputTokens: 200, cost: 0.01 })`: both metrics are set.
- After `spinner.start()` and a 100ms delay, `metrics.elapsedMs` is approximately 100.

**TPS auto-calculation tests**:
- Call `addTokens(1)` twenty times with 50ms intervals. Verify `metrics.tps` is approximately 20.
- Call `addTokens(5)` four times with 100ms intervals. Verify `metrics.tps` is approximately 50.
- Call `addTokens(1)` once. Verify `metrics.tps` is 0 (insufficient data).

**Cost calculation tests**:
- Create spinner with `model: 'gpt-4o'`. Set `inputTokens` to 1000, `outputTokens` to 500. Verify `metrics.cost` is `(1000 * 2.50 / 1_000_000) + (500 * 10.00 / 1_000_000)` = $0.0075.
- Create spinner with no model. Verify `metrics.cost` is 0 regardless of token counts.
- Create spinner with custom `pricing: { inputCostPerMillion: 1.0, outputCostPerMillion: 2.0 }`. Verify cost calculation uses custom pricing.

**Format template tests**:
- Template `'{spinner} {text} {tokens}'` with 142 tokens: renders `'⠋ Working... 142 tokens'`.
- Template `'{spinner} {text} {tokens} · {cost}'` with no cost data: renders `'⠋ Working... 142 tokens'` (cost and its separator omitted).
- Template `'{symbol} {text} · {tokens} · {elapsed}'` in complete state: renders `'✓ Done · 142 tokens · 2.1s'`.
- Consecutive separators from omitted placeholders: collapsed (no `· ·` in output).

**Number formatting tests**:
- Token count 999: `'999 tokens'`. Token count 1000: `'1,000 tokens'`. Token count 12345: `'12,345 tokens'`.
- TPS 38.24: `'38.2 tok/s'`. TPS 0.82: `'0.8 tok/s'`. TPS 100.0: `'100.0 tok/s'`.
- Cost 0.0034: `'$0.003'`. Cost 0.12: `'$0.12'`. Cost 1.239: `'$1.24'`.
- Elapsed 2134ms: `'2.1s'`. Elapsed 72000ms: `'1m 12s'`.

**Rate limit countdown tests**:
- `spinner.rateLimited(30)`: `metrics.countdownSeconds` is 30.
- After 1 second: `metrics.countdownSeconds` is 29.
- After 30 seconds: `metrics.countdownSeconds` is 0.
- Countdown renders as `'⏳ Rate limited · retrying in 30s'`, decrementing each second.

**TTFT measurement tests**:
- Call `spinner.start()`, wait 200ms, call `spinner.streaming()`. Verify `metrics.ttftMs` is approximately 200.
- Call `spinner.start()`, immediately call `spinner.streaming()`. Verify `metrics.ttftMs` is approximately 0.

**Disabled spinner tests**:
- `createSpinner({ enabled: false })`: `spinner.start()`, `spinner.addTokens(10)`, `spinner.succeed()` all return `this` without errors.
- No output is written to the stream.

### Stream Wrapping Tests

**OpenAI stream wrapping**:
- Create a mock `AsyncIterable<ChatCompletionChunk>` that yields 10 chunks with `delta.content` set to a word each.
- Wrap with `spinner.wrapStream(stream, { format: 'openai' })`.
- Consume the stream. Verify: spinner transitioned to `streaming`, `metrics.outputTokens` is 10, `metrics.ttftMs` is defined, all original chunks are yielded unchanged.
- Add a final chunk with `usage: { prompt_tokens: 50, completion_tokens: 10 }`. Verify `metrics.inputTokens` is 50 and `metrics.outputTokens` is corrected to 10.

**Anthropic stream wrapping**:
- Create a mock stream with `message_start`, `content_block_delta` (5 events), and `message_delta` events.
- Wrap with `spinner.wrapStream(stream, { format: 'anthropic' })`.
- Consume the stream. Verify: spinner transitioned to `streaming`, token count is updated from delta events, input tokens are extracted from `message_start`, output tokens are corrected from `message_delta`.

**Generic stream wrapping**:
- Create a mock `AsyncIterable<string>` yielding 5 strings.
- Wrap with `spinner.wrapStream(stream, { format: 'text' })`.
- Consume. Verify: tokens are estimated from string lengths, all original values are yielded.

**Auto-detection test**:
- Wrap an OpenAI-format stream with `format: 'auto'`. Verify it is detected as OpenAI.
- Wrap an Anthropic-format stream with `format: 'auto'`. Verify it is detected as Anthropic.
- Wrap a plain string stream with `format: 'auto'`. Verify it falls back to generic.

**Error propagation**:
- Create a mock stream that throws an error after 3 chunks.
- Wrap it. Consume until error. Verify: error propagates to the caller, spinner is still in `streaming` state (not automatically transitioned to `error`; the caller must call `fail()`).

### Pipeline Tests

**Pipeline lifecycle tests**:
- `createPipeline([{ name: 'A' }, { name: 'B' }, { name: 'C' }])`: `totalSteps` is 3, `currentStep` is 0, `isComplete` is false.
- `pipeline.start()`: `currentStep` is 0.
- `pipeline.next()`: marks step 0 complete, `currentStep` is 1.
- `pipeline.next()`: marks step 1 complete, `currentStep` is 2.
- `pipeline.next()`: marks step 2 complete, `isComplete` is true.
- `pipeline.complete()` from step 1: marks steps 1, 2 as complete.
- `pipeline.fail('Error')` from step 1: marks step 1 as failed, steps 2 remains pending.

**Pipeline progress update tests**:
- `pipeline.update({ progress: 47 })` on a step with `total: 100`. Verify display includes `47/100`.
- `pipeline.addTokens(10)`. Verify token count is proxied to the active step.

### Rendering Tests

Rendering tests capture the output written to the stream (using a writable buffer) and verify the content. These tests do not verify pixel-level rendering but verify that the correct text, escape codes, and formatting are produced.

- **TTY mode**: Verify that cursor hide, cursor show, line clear, and carriage return escape codes are present in the output.
- **Non-TTY mode**: Verify that no escape codes are present. Verify that only start and completion lines are written.
- **Color mode**: Verify ANSI color codes are present when color is enabled and absent when disabled.
- **Truncation**: Set `stream.columns` to 40. Render a line that would be 80 characters. Verify the output is truncated to 40 characters with an ellipsis.

### Test Framework

Tests use Vitest, matching the project's existing configuration. Mock streams are implemented as async generators. The output stream is mocked with a writable buffer that collects all written data for assertion.

---

## 15. Performance

### Render Loop

The render loop runs on a `setInterval` at the configured `interval` (default 80ms, yielding approximately 12.5 frames per second). Each render cycle:

1. Computes the current spinner frame (array index modulo frame count).
2. Reads current metrics (token count, TPS, cost, elapsed time, countdown).
3. Renders the format template with metric values.
4. Writes the rendered line to the output stream with cursor positioning.

### CPU Overhead

The render loop is the primary source of CPU usage. At 80ms intervals, the per-render work is:

- Template string interpolation: ~0.01ms.
- Number formatting: ~0.01ms.
- Stream write: ~0.01ms (buffered I/O to stderr).
- Total per-render: ~0.03ms.

At 12.5 renders per second, the total CPU cost is approximately 0.375ms per second, which is 0.0375% of one CPU core. This is negligible.

### Memory

The spinner maintains:
- Metric counters: 7 numeric values (64 bytes).
- TPS sliding window: 20 entries with timestamps (320 bytes).
- Format template string: typically <100 bytes.
- Rendered line buffer: typically <200 bytes.

Total memory per spinner instance: under 1KB. Memory usage does not grow over time.

### Stream Wrapping Overhead

The `wrapStream` async generator adds one `performance.now()` call and one `addTokens()` call per chunk. Per-chunk overhead is under 0.01ms. For a stream delivering 100 tokens per second, the total overhead is under 1ms per second. This is well below 1% of the streaming duration and is imperceptible.

### Render Loop Cleanup

The `setInterval` timer is cleared when the spinner stops (via `stop()`, `succeed()`, or `fail()`). Failing to stop the spinner would leak the interval timer. The process exit handler also clears the timer as a safety net.

---

## 16. Dependencies

### Runtime Dependencies

Zero mandatory runtime dependencies. All functionality is implemented using Node.js built-ins:

- `performance.now()` from `perf_hooks` for high-resolution timing.
- `process.stderr` for output.
- `process.stdout.columns` for terminal width.
- `setInterval` / `clearInterval` for the render loop.
- ANSI escape codes for terminal control (raw strings, no library).

### Why No Dependency on `ora`, `cli-spinners`, or Similar

The spinner animation logic (cycling through frame arrays, writing to a stream, cursor management) is straightforward to implement in approximately 100 lines of code. Adding a dependency on `ora` (which has 3 transitive dependencies) would provide features `ai-spinner` does not need (promise integration, spinner persistence, Unicode fallback detection for old terminals) while making the AI-specific rendering harder to customize. `cli-spinners` is a JSON data file of spinner frame arrays; the 5 presets built into `ai-spinner` cover the common cases, and callers can pass custom frame arrays for anything else.

### Optional Peer Dependencies

None. `ai-spinner` does not import any LLM SDK. The `wrapStream` method operates on `AsyncIterable<unknown>` and inspects chunk shapes at runtime. The OpenAI and Anthropic type definitions in the spec above are illustrative; the actual implementation uses runtime duck-typing (checking for `choices[0].delta.content` or `event.type === 'content_block_delta'`) rather than compile-time type imports.

### Development Dependencies

| Dependency | Purpose |
|-----------|---------|
| `typescript` | TypeScript compiler. |
| `vitest` | Test runner. |
| `eslint` | Linter. |
| `@types/node` | Node.js type definitions. |

---

## 17. File Structure

```
ai-spinner/
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
└── src/
    ├── index.ts              # Public API re-exports: createSpinner, createPipeline, types
    ├── spinner.ts            # AISpinner class: state machine, metric tracking, lifecycle
    ├── pipeline.ts           # AIPipeline class: multi-step rendering, step management
    ├── renderer.ts           # Terminal rendering: format templates, ANSI codes, cursor mgmt
    ├── metrics.ts            # SpinnerMetrics tracking, TPS sliding window, cost calculation
    ├── pricing.ts            # Built-in model pricing table, pricing lookup
    ├── stream.ts             # wrapStream implementation: OpenAI, Anthropic, generic adapters
    ├── format.ts             # Number formatting (tokens, cost, TPS, elapsed), template parsing
    ├── terminal.ts           # TTY detection, color support, CI detection, terminal width
    ├── presets.ts             # Spinner frame presets (dots, line, arc, arrow, bounce)
    ├── types.ts              # All TypeScript type definitions and interfaces
    └── __tests__/
        ├── spinner.test.ts         # State machine and lifecycle tests
        ├── metrics.test.ts         # Metric tracking and TPS calculation tests
        ├── stream.test.ts          # Stream wrapping tests (OpenAI, Anthropic, generic)
        ├── pipeline.test.ts        # Pipeline lifecycle and rendering tests
        ├── renderer.test.ts        # Terminal rendering and format template tests
        ├── format.test.ts          # Number formatting tests
        ├── pricing.test.ts         # Cost calculation and pricing table tests
        ├── terminal.test.ts        # TTY/color/CI detection tests
        └── integration.test.ts     # End-to-end spinner + stream tests
```

---

## 18. Implementation Roadmap

### Phase 1: Core Spinner

Implement the foundational spinner with the state machine and basic rendering. All subsequent phases depend on this.

1. **`types.ts`**: Define all TypeScript interfaces: `SpinnerOptions`, `AISpinner`, `SpinnerState`, `SpinnerMetrics`, `StreamingOptions`, `ToolCallOptions`, `RateLimitOptions`, and related types.

2. **`presets.ts`**: Implement the spinner frame presets. Export the preset map and the frame array type.

3. **`terminal.ts`**: Implement TTY detection, color support detection, CI detection, and terminal width reading. Export utility functions: `isTTY(stream)`, `supportsColor(stream)`, `getColumns(stream)`.

4. **`format.ts`**: Implement number formatting functions: `formatTokens(n)`, `formatTPS(n)`, `formatCost(n)`, `formatElapsed(ms)`, `formatCountdown(s)`. Write unit tests.

5. **`renderer.ts`**: Implement the format template engine (parse templates, substitute placeholders, collapse empty separators) and the terminal writer (cursor management, line clearing, ANSI color application, line truncation). Write unit tests.

6. **`metrics.ts`**: Implement the `SpinnerMetrics` tracker with TPS sliding window. Export the metrics class with `addTokens()`, `setInputTokens()`, `setTPS()`, `setCost()`, `update()`, `reset()`, and `getMetrics()`. Write unit tests for TPS calculation.

7. **`spinner.ts`**: Implement the `AISpinner` class. Wire up the state machine (all state transitions), the render loop (`setInterval`), metric updates, and the process exit cleanup handler. Implement `start()`, `stop()`, `reset()`, `streaming()`, `toolCall()`, `rateLimited()`, `processing()`, `succeed()`, `fail()`, `addTokens()`, `setInputTokens()`, `setTPS()`, `setCost()`, `update()`, and the `text`, `state`, `metrics`, `isActive` properties.

8. **`index.ts`**: Export `createSpinner` factory function and all public types.

Milestone: `createSpinner()` works. The spinner animates, transitions through states, tracks metrics, and renders to the terminal. `npm run test`, `npm run lint`, and `npm run build` all pass.

### Phase 2: Streaming Integration

9. **`stream.ts`**: Implement `wrapStream()` with the three adapters (OpenAI, Anthropic, generic) and the auto-detection logic. Write tests against mock streams.

10. **`spinner.ts` update**: Wire `wrapStream` into the `AISpinner` class.

Milestone: `spinner.wrapStream(openaiStream)` automatically counts tokens, measures TTFT, and updates the display.

### Phase 3: Cost Estimation

11. **`pricing.ts`**: Implement the built-in model pricing table and the pricing lookup function. Write tests for cost calculation with various models and custom pricing overrides.

12. **`metrics.ts` update**: Integrate pricing lookup into the auto-cost calculation. When a model is configured and pricing is available, `metrics.cost` auto-updates whenever token counts change.

Milestone: The spinner displays real-time cost estimates during streaming when a model is configured.

### Phase 4: Pipeline

13. **`pipeline.ts`**: Implement the `AIPipeline` class. Wire up multi-line terminal rendering with cursor management. Implement `start()`, `next()`, `fail()`, `complete()`, `update()`, `addTokens()`, `setCost()`, `setTPS()`. Write tests.

14. **`index.ts` update**: Export `createPipeline` and pipeline types.

Milestone: `createPipeline(steps)` renders a multi-step progress display with per-step metrics and completion indicators.

### Phase 5: Polish and Documentation

15. **Edge case handling**: Terminal resize, long text truncation, rapid state transitions, rate limit countdown timer edge cases (countdown reaching zero, multiple rate limits in sequence).

16. **Non-TTY fallback**: Ensure clean text-only output in all non-TTY scenarios. Test in CI-like environments.

17. **Documentation**: Write the README with quickstart examples, API reference, and migration guide from `ora`. Ensure all public methods have complete JSDoc comments.

18. **Performance verification**: Benchmark the render loop CPU overhead. Verify the stream wrapping overhead is under 1% for realistic stream speeds.

Milestone: All phases complete. `npm run test`, `npm run lint`, and `npm run build` all pass. Package is ready for v0.1.0 publication.

---

## 19. Example Use Cases

### Example 1: Streaming Chatbot CLI

A command-line chatbot that shows token generation progress and cost.

```typescript
import { createSpinner } from 'ai-spinner';
import OpenAI from 'openai';

const openai = new OpenAI();
const spinner = createSpinner({ model: 'gpt-4o' });

async function chat(userMessage: string): Promise<string> {
  spinner.start('Calling gpt-4o...');

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
    stream_options: { include_usage: true },
  });

  const instrumented = spinner.wrapStream(stream);

  let response = '';
  for await (const chunk of instrumented) {
    response += chunk.choices[0]?.delta?.content ?? '';
  }

  spinner.succeed('Response generated');
  return response;
}

const answer = await chat('Explain quantum computing in 3 sentences.');
console.log(answer);
```

**Terminal during execution**:
```
⠋ Calling gpt-4o...                          (for ~800ms, TTFT)
⠙ Generating... 12 tokens · 15.3 tok/s · $0.001   (streaming begins)
⠹ Generating... 47 tokens · 38.2 tok/s · $0.002
⠸ Generating... 89 tokens · 41.0 tok/s · $0.003
✓ Response generated · 89 tokens · 2.1s · $0.003    (final)
```

### Example 2: RAG Pipeline with Progress

A retrieval-augmented generation pipeline showing each stage.

```typescript
import { createPipeline } from 'ai-spinner';
import OpenAI from 'openai';

const openai = new OpenAI();

const pipeline = createPipeline([
  { name: 'Searching knowledge base' },
  { name: 'Embedding chunks', total: 50 },
  { name: 'Generating response' },
  { name: 'Validating citations' },
]);

pipeline.start();

// Step 1: Search
const docs = await searchKnowledgeBase(query);
pipeline.next();

// Step 2: Embed
for (let i = 0; i < docs.length; i++) {
  await embedDocument(docs[i]);
  pipeline.update({ progress: i + 1 });
}
pipeline.next();

// Step 3: Generate
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: buildMessages(query, docs),
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    pipeline.addTokens(1);
    response += content;
  }
}
pipeline.next();

// Step 4: Validate
await validateCitations(response, docs);
pipeline.complete();
```

**Terminal during execution**:
```
✓ [1/4] Searching knowledge base... done (0.3s)
✓ [2/4] Embedding chunks... done (1.2s)
⠋ [3/4] Generating response... 142 tokens · 38.2 tok/s
─ [4/4] Validating citations...
```

### Example 3: Rate Limit Handling

A batch processing script that gracefully handles 429 responses.

```typescript
import { createSpinner } from 'ai-spinner';
import OpenAI from 'openai';

const openai = new OpenAI();
const spinner = createSpinner({ model: 'gpt-4o-mini' });

async function processWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  spinner.start(`Processing: ${prompt.slice(0, 40)}...`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });

      const instrumented = spinner.wrapStream(stream);
      let result = '';
      for await (const chunk of instrumented) {
        result += chunk.choices[0]?.delta?.content ?? '';
      }

      spinner.succeed('Done');
      return result;
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = parseInt(error.headers?.['retry-after'] ?? '30', 10);
        spinner.rateLimited(retryAfter, { reason: '429 Too Many Requests' });

        // Wait for the countdown to complete
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

        // Retry
        spinner.start(`Retrying: ${prompt.slice(0, 40)}...`);
        continue;
      }
      spinner.fail(`Error: ${error.message}`);
      throw error;
    }
  }

  spinner.fail('Max retries exceeded');
  throw new Error('Max retries exceeded');
}
```

**Terminal during execution**:
```
⠋ Processing: Explain the theory of rela...
⏳ Rate limited (429 Too Many Requests) · retrying in 30s
⏳ Rate limited (429 Too Many Requests) · retrying in 29s
...
⏳ Rate limited (429 Too Many Requests) · retrying in 1s
⠋ Retrying: Explain the theory of rela...
⠙ Generating... 34 tokens · 42.1 tok/s · $0.001
✓ Done · 156 tokens · 32.4s · $0.001
```

### Example 4: Tool-Calling Agent

An agent that shows tool execution progress.

```typescript
import { createSpinner } from 'ai-spinner';

const spinner = createSpinner({ model: 'gpt-4o' });
spinner.start('Thinking...');

// First LLM call returns tool calls
const toolCalls = await getToolCalls(messages);

// Execute tool calls
for (let i = 0; i < toolCalls.length; i++) {
  const tool = toolCalls[i];
  spinner.toolCall(tool.function.name, {
    index: i + 1,
    total: toolCalls.length,
  });

  const result = await executeTool(tool);
  messages.push({ role: 'tool', content: result, tool_call_id: tool.id });
}

// Second LLM call generates final response using tool results
spinner.streaming({ text: 'Generating final response...' });
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
  stream: true,
});

const instrumented = spinner.wrapStream(stream);
let response = '';
for await (const chunk of instrumented) {
  response += chunk.choices[0]?.delta?.content ?? '';
}

spinner.succeed('Response generated');
```

**Terminal during execution**:
```
⠋ Thinking...
⠙ Running search_web... (tool 1/3)
⠹ Running get_weather... (tool 2/3)
⠸ Running calculate... (tool 3/3)
⠼ Generating final response... 67 tokens · 35.2 tok/s · $0.008
✓ Response generated · 243 tokens · 4.7s · $0.012
```

### Example 5: Simple Drop-In Replacement for ora

For developers migrating from `ora` who want AI awareness without changing their code structure.

```typescript
// Before (with ora):
import ora from 'ora';
const spinner = ora('Loading...').start();
// ... do work ...
spinner.succeed('Done');

// After (with ai-spinner, basic usage):
import { createSpinner } from 'ai-spinner';
const spinner = createSpinner({ text: 'Loading...' }).start();
// ... do work ...
spinner.succeed('Done');

// After (with ai-spinner, AI-aware usage):
import { createSpinner } from 'ai-spinner';
const spinner = createSpinner({ text: 'Loading...', model: 'gpt-4o' }).start();
const stream = await openai.chat.completions.create({ model: 'gpt-4o', messages, stream: true });
const instrumented = spinner.wrapStream(stream);
for await (const chunk of instrumented) { /* ... */ }
spinner.succeed();
```

The migration path is: replace the import, replace `ora(text)` with `createSpinner({ text })`, and optionally add `model` and `wrapStream` for AI-specific features. The `start()`, `succeed()`, `fail()`, `text`, and `stop()` methods have identical semantics.
