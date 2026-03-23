# ai-spinner — Task Breakdown

This file contains all tasks required to implement `ai-spinner` as described in SPEC.md. Tasks are grouped into phases and ordered by dependency. Each task includes a description and status.

---

## Phase 1: Project Setup & Scaffolding

- [x] **Install dev dependencies** — Add `typescript`, `vitest`, `eslint`, and `@types/node` as devDependencies in `package.json`. Run `npm install` to generate `node_modules` and `package-lock.json`. | Status: done
- [x] **Configure ESLint** — Create an ESLint config file (`.eslintrc` or `eslint.config.mjs`) with TypeScript support. Ensure `npm run lint` works against the `src/` directory. | Status: done
- [x] **Configure Vitest** — Create a `vitest.config.ts` if needed or verify that `vitest run` works with the existing `tsconfig.json`. Ensure `npm run test` executes correctly (even with zero tests). | Status: done
- [x] **Verify build pipeline** — Run `npm run build` and confirm `tsc` compiles `src/index.ts` into `dist/index.js` with declarations. Fix any tsconfig issues. | Status: done
- [x] **Create source file skeleton** — Create all source files specified in the file structure: `src/types.ts`, `src/presets.ts`, `src/terminal.ts`, `src/format.ts`, `src/renderer.ts`, `src/metrics.ts`, `src/pricing.ts`, `src/spinner.ts`, `src/stream.ts`, `src/pipeline.ts`. Each file starts with a minimal placeholder export. | Status: done
- [x] **Create test file skeleton** — Create all test files: `src/__tests__/spinner.test.ts`, `src/__tests__/metrics.test.ts`, `src/__tests__/stream.test.ts`, `src/__tests__/pipeline.test.ts`, `src/__tests__/renderer.test.ts`, `src/__tests__/format.test.ts`, `src/__tests__/pricing.test.ts`, `src/__tests__/terminal.test.ts`, `src/__tests__/integration.test.ts`. Each file starts with a single placeholder test. | Status: done

---

## Phase 2: Type Definitions (`src/types.ts`)

- [x] **Define SpinnerState type** — Define the `SpinnerState` union type: `'idle' | 'waiting' | 'streaming' | 'tool-calling' | 'rate-limited' | 'processing' | 'complete' | 'error'`. | Status: done
- [x] **Define SpinnerPreset type** — Define the `SpinnerPreset` union type: `'dots' | 'line' | 'arc' | 'arrow' | 'bounce'`. | Status: done
- [x] **Define ModelPricing interface** — Define `ModelPricing` with `inputCostPerMillion: number` and `outputCostPerMillion: number`. | Status: done
- [x] **Define SpinnerOptions interface** — Define all fields: `text`, `spinner`, `interval`, `stream`, `color`, `model`, `pricing`, `tokenBudget`, `streamingFormat`, `completeFormat`, `waitingFormat`, `errorFormat`, `showModel`, `showElapsed`, `successSymbol`, `failSymbol`, `rateLimitSymbol`, `enabled`. Include JSDoc comments for each field with defaults documented. | Status: done
- [x] **Define SpinnerMetrics interface** — Define fields: `outputTokens`, `inputTokens`, `tps`, `cost`, `elapsedMs`, `ttftMs?`, `model?`, `countdownSeconds?`. | Status: done
- [x] **Define StreamingOptions interface** — Define fields: `text?`, `model?`, `inputTokens?`. | Status: done
- [x] **Define ToolCallOptions interface** — Define fields: `index?`, `total?`. | Status: done
- [x] **Define RateLimitOptions interface** — Define fields: `reason?`, `statusCode?`. | Status: done
- [x] **Define WrapStreamOptions interface** — Define fields: `text?`, `model?`, `inputTokens?`, `format?: 'openai' | 'anthropic' | 'text' | 'auto'`. | Status: done
- [x] **Define AISpinner interface** — Define the full public interface with all lifecycle methods (`start`, `stop`, `reset`), state transition methods (`streaming`, `toolCall`, `rateLimited`, `processing`, `succeed`, `fail`), metric update methods (`addTokens`, `setInputTokens`, `setTPS`, `setCost`, `update`), stream integration (`wrapStream`), and properties (`text`, `state`, `metrics`, `isActive`). All methods return `AISpinner` for chaining. | Status: done
- [x] **Define PipelineStepConfig interface** — Define fields: `name: string`, `total?: number`. | Status: done
- [x] **Define PipelineOptions interface** — Define fields: `stream?`, `color?`, `spinner?`, `showIndex?`, `showDuration?`. | Status: done
- [x] **Define AIPipeline interface** — Define all methods: `start`, `next`, `fail`, `complete`, `update`, `addTokens`, `setCost`, `setTPS`, and properties: `currentStep`, `totalSteps`, `isComplete`. | Status: done
- [x] **Define PipelineUpdateData interface** — Define fields: `progress?`, `text?`, `tokens?`, `cost?`, `tps?`. | Status: done
- [x] **Export all types from types.ts** — Ensure every type/interface is exported for use by other modules and by consumers of the package. | Status: done

---

## Phase 3: Spinner Presets (`src/presets.ts`)

- [x] **Define spinner frame arrays** — Implement the 5 presets with their frame arrays: `dots` (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`), `line` (`-\|/`), `arc` (`◜◠◝◞◡◟`), `arrow` (`←↖↑↗→↘↓↙`), `bounce` (`⠁⠂⠄⠂`). | Status: done
- [x] **Define default intervals per preset** — Map each preset to its default interval: dots=80ms, line=130ms, arc=100ms, arrow=120ms, bounce=120ms. | Status: done
- [x] **Export preset lookup function** — Export a function `getPreset(name: SpinnerPreset)` that returns `{ frames: string[], interval: number }`. Also export the type for custom frame arrays. | Status: done

---

## Phase 4: Terminal Utilities (`src/terminal.ts`)

- [x] **Implement TTY detection** — Create `isTTY(stream: NodeJS.WritableStream): boolean` that checks `stream.isTTY === true`. | Status: done
- [x] **Implement CI environment detection** — Create `isCI(): boolean` that checks `process.env.CI === 'true'` or similar truthy values. | Status: done
- [x] **Implement color support detection** — Create `supportsColor(stream: NodeJS.WritableStream, colorOption?: boolean): boolean` implementing the priority chain: explicit option > `FORCE_COLOR` > `NO_COLOR` > `stream.hasColors()` > `stream.isTTY` > false. | Status: done
- [x] **Implement terminal width reading** — Create `getColumns(stream: NodeJS.WritableStream): number` that reads `stream.columns` with a sensible fallback (e.g., 80). | Status: done
- [x] **Implement AI_SPINNER_ENABLED env var check** — Create `isEnabledByEnv(): boolean | undefined` that reads `AI_SPINNER_ENABLED` and returns `true`, `false`, or `undefined` (not set). | Status: done
- [x] **Write terminal.test.ts** — Test TTY detection with mock streams (isTTY true/false). Test color detection with various env var combinations (`NO_COLOR`, `FORCE_COLOR=0`, `FORCE_COLOR=1`). Test CI detection. Test `getColumns` with mock stream columns. Test `AI_SPINNER_ENABLED` parsing. | Status: done

---

## Phase 5: Number Formatting (`src/format.ts`)

- [x] **Implement formatTokens(n)** — Format token counts: values < 1000 as plain numbers (e.g., `142 tokens`), values >= 1000 with comma separators (e.g., `1,203 tokens`). | Status: done
- [x] **Implement formatTPS(n)** — Format tokens per second with one decimal place (e.g., `38.2 tok/s`). Handle values below 1.0 (e.g., `0.8 tok/s`). | Status: done
- [x] **Implement formatCost(n)** — Format cost with dollar sign: values < $0.01 with 3 decimal places (`$0.003`), values $0.01-$1.00 with 2 decimal places (`$0.12`), values > $1.00 with 2 decimal places (`$1.24`). | Status: done
- [x] **Implement formatElapsed(ms)** — Format elapsed time: values < 60s as seconds with one decimal (`2.1s`), values >= 60s as minutes and integer seconds (`1m 23s`). | Status: done
- [x] **Implement formatCountdown(s)** — Format countdown as integer seconds (`23s`). | Status: done
- [x] **Write format.test.ts** — Test each formatter with edge cases: `formatTokens(0)`, `formatTokens(999)`, `formatTokens(1000)`, `formatTokens(12345)`. `formatTPS(38.24)` -> `38.2 tok/s`, `formatTPS(0.82)` -> `0.8 tok/s`, `formatTPS(100.0)` -> `100.0 tok/s`. `formatCost(0.0034)` -> `$0.003`, `formatCost(0.12)` -> `$0.12`, `formatCost(1.239)` -> `$1.24`. `formatElapsed(2134)` -> `2.1s`, `formatElapsed(72000)` -> `1m 12s`. `formatCountdown(23)` -> `23s`, `formatCountdown(0)` -> `0s`. | Status: done

---

## Phase 6: Template Renderer (`src/renderer.ts`)

- [x] **Implement template parser** — Parse format template strings containing placeholders like `{spinner}`, `{text}`, `{tokens}`, `{tps}`, `{cost}`, `{elapsed}`, `{budget}`, `{model}`, `{ttft}`, `{tool}`, `{toolIndex}`, `{countdown}`, `{symbol}`, `{inputTokens}`, `{outputTokens}`. | Status: done
- [x] **Implement placeholder substitution** — Replace each placeholder with its formatted value from the current metrics/state. Placeholders with no available value (e.g., `{cost}` when pricing is unavailable) produce empty strings. | Status: done
- [x] **Implement separator collapsing** — After substitution, collapse consecutive separators (`·`) that result from omitted placeholders. Remove leading/trailing separators. Avoid `· ·` artifacts in the output. | Status: done
- [x] **Implement ANSI color application** — Apply ANSI color codes to each rendered element per the color scheme: spinner frames=cyan, success symbol=green, error symbol=red, rate limit symbol=yellow, TPS=dim, cost=yellow, elapsed=dim, separators=dim, model name=dim. | Status: done
- [x] **Implement line truncation** — Truncate the rendered line to fit within `stream.columns` by cutting with an ellipsis character when the line exceeds terminal width. | Status: done
- [x] **Implement cursor management** — Implement helper functions for cursor hide (`\x1b[?25l`), cursor show (`\x1b[?25h`), carriage return (`\r`), clear line (`\x1b[2K`), move up (`\x1b[<n>A`), move down (`\x1b[<n>B`). | Status: done
- [x] **Implement non-TTY rendering** — When the stream is not a TTY, skip cursor management and ANSI codes. Print only start and completion lines as plain text. | Status: done
- [x] **Write renderer.test.ts** — Test template parsing and substitution with various templates. Test separator collapsing (omitted placeholders produce no `· ·`). Test ANSI codes present when color=true and absent when color=false. Test line truncation to a specific column width. Test non-TTY mode produces no escape codes. | Status: done

---

## Phase 7: Metrics Tracking (`src/metrics.ts`)

- [x] **Implement SpinnerMetrics class** — Create a class that holds all metric values: `outputTokens`, `inputTokens`, `tps`, `cost`, `elapsedMs`, `ttftMs`, `model`, `countdownSeconds`. Initialize all to zero/undefined. | Status: done
- [x] **Implement addTokens(count)** — Increment `outputTokens` by `count` (default 1). Record the timestamp and count in the TPS sliding window. Recalculate TPS. | Status: done
- [x] **Implement TPS sliding window** — Maintain a circular buffer of the last 20 token arrival records (timestamp + count). Compute TPS as (total tokens in window) / (time span of window in seconds). Return 0 if fewer than 2 data points. | Status: done
- [x] **Implement setInputTokens(count)** — Set `inputTokens` to the provided value. | Status: done
- [x] **Implement setTPS(rate)** — Manually override the auto-calculated TPS value. | Status: done
- [x] **Implement setCost(cost)** — Manually set the cost value. | Status: done
- [x] **Implement update(partial)** — Bulk-update multiple metrics from a partial `SpinnerMetrics` object. | Status: done
- [x] **Implement reset()** — Reset all metrics to their initial values. Clear the TPS sliding window. | Status: done
- [x] **Implement getMetrics()** — Return a readonly snapshot of current metrics. Compute `elapsedMs` dynamically from the start timestamp. | Status: done
- [x] **Implement startTimer()** — Record the start timestamp for elapsed time calculation. | Status: done
- [x] **Implement recordTTFT()** — Compute and store TTFT as `performance.now() - startTimestamp`. Only record on first call (subsequent calls are no-ops). | Status: done
- [x] **Write metrics.test.ts** — Test `addTokens(5)` increments by 5. Test `addTokens()` increments by 1. Test `setInputTokens(100)` sets to 100. Test `setCost(0.005)` sets to 0.005. Test `setTPS(42.5)` sets to 42.5. Test `update()` sets multiple metrics. Test `reset()` clears everything. Test elapsed time calculation after start. Test TTFT measurement. | Status: done
- [x] **Write TPS calculation tests** — Test: call `addTokens(1)` 20 times with 50ms intervals, verify TPS ~20. Call `addTokens(5)` 4 times with 100ms intervals, verify TPS ~50. Call `addTokens(1)` once, verify TPS is 0 (insufficient data). | Status: done

---

## Phase 8: Model Pricing (`src/pricing.ts`)

- [x] **Implement built-in price table** — Create a `Map<string, ModelPricing>` containing all 14 models from the spec: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, `o1`, `o1-mini`, `o3`, `o3-mini`, `claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `claude-haiku-3-5`, `gemini-2.0-flash`, `gemini-2.0-pro` with their exact input/output costs per million tokens. | Status: done
- [x] **Implement pricing lookup function** — Create `getModelPricing(model: string, customPricing?: ModelPricing): ModelPricing | undefined` that checks custom pricing first, then the built-in table. Return undefined if not found. | Status: done
- [x] **Implement cost calculation function** — Create `calculateCost(inputTokens: number, outputTokens: number, pricing: ModelPricing): number` that computes `(inputTokens * inputCostPerMillion / 1_000_000) + (outputTokens * outputCostPerMillion / 1_000_000)`. | Status: done
- [x] **Write pricing.test.ts** — Test built-in pricing lookup for all 14 models. Test custom pricing overrides built-in. Test unknown model returns undefined. Test cost calculation: `gpt-4o` with 1000 input, 500 output = $0.0075. Test cost with no model = 0. Test cost with custom pricing. | Status: done

---

## Phase 9: Core Spinner (`src/spinner.ts`)

- [x] **Implement AISpinner class constructor** — Accept `SpinnerOptions`, merge with defaults, resolve spinner preset (if string) or use custom frames, resolve interval, detect TTY/color/enabled, store the output stream reference. Initialize state to `idle`. | Status: done
- [x] **Implement start() method** — Transition from `idle` to `waiting`. Accept optional text override. Start the render loop (`setInterval`). Hide the cursor. Record start timestamp for elapsed time. Register process exit/SIGINT handlers for cleanup. | Status: done
- [x] **Implement stop() method** — Stop the render loop. Clear the current line. Show the cursor. Remove process event handlers. Do not print a final line. Can be called from any state. | Status: done
- [x] **Implement reset() method** — Stop the spinner if active. Reset state to `idle`. Clear all metrics. Allow the spinner to be reused. | Status: done
- [x] **Implement streaming() method** — Transition to `streaming` from `waiting`, `tool-calling`, or `rate-limited`. Accept `StreamingOptions` (text, model, inputTokens). On first call from `waiting`, record TTFT. Update text if provided. Set model if provided. Set input tokens if provided. | Status: done
- [x] **Implement toolCall() method** — Transition to `tool-calling` from `waiting`, `streaming`, or another `tool-calling`. Accept `toolName: string` and optional `ToolCallOptions` (index, total). Store tool name and index for display. | Status: done
- [x] **Implement rateLimited() method** — Transition to `rate-limited` from any active state. Accept `seconds: number` and optional `RateLimitOptions` (reason, statusCode). Set `countdownSeconds` in metrics. Start a 1-second countdown interval that decrements `countdownSeconds` each second until 0. Stop the countdown interval when countdown reaches 0 or state changes. | Status: done
- [x] **Implement processing() method** — Transition to `processing` from `streaming`, `tool-calling`, or `waiting`. Accept optional text. | Status: done
- [x] **Implement succeed() method** — Transition to `complete` from any active state. Stop the render loop. Clear the spinner line. Render and print the final success line using `completeFormat`. Show the cursor. Accept optional text for the summary. | Status: done
- [x] **Implement fail() method** — Transition to `error` from any active state. Stop the render loop. Clear the spinner line. Render and print the final error line using `errorFormat`. Show the cursor. Accept optional text for the error message (default: `'Failed'`). | Status: done
- [x] **Implement state validation** — Enforce valid state transitions. `succeed()` and `fail()` callable from any active state. `start()` from `complete`/`error` is a no-op (require `reset()` first). Terminal states (`complete`, `error`) reject further transitions. | Status: done
- [x] **Implement render loop** — Use `setInterval` at the configured interval. On each tick: advance the frame index (modulo frame count), compute current metrics (elapsed time, auto-cost from pricing), render the appropriate format template for the current state, write the rendered line to the stream with line-clear and carriage-return. | Status: done
- [x] **Implement addTokens() method** — Proxy to the metrics tracker's `addTokens()`. Return `this` for chaining. | Status: done
- [x] **Implement setInputTokens() method** — Proxy to the metrics tracker. Return `this`. | Status: done
- [x] **Implement setTPS() method** — Proxy to the metrics tracker. Return `this`. | Status: done
- [x] **Implement setCost() method** — Proxy to the metrics tracker. Return `this`. | Status: done
- [x] **Implement update() method** — Proxy to the metrics tracker's bulk update. Return `this`. | Status: done
- [x] **Implement text property (getter/setter)** — Get/set the current text label. Setting the text updates the display on the next render cycle. | Status: done
- [x] **Implement state property (getter)** — Return the current `SpinnerState`. Read-only. | Status: done
- [x] **Implement metrics property (getter)** — Return a readonly snapshot of the current `SpinnerMetrics`. Read-only. | Status: done
- [x] **Implement isActive property (getter)** — Return `true` if the spinner is in an active state (`waiting`, `streaming`, `tool-calling`, `rate-limited`, `processing`). Return `false` for `idle`, `complete`, `error`. | Status: done
- [x] **Implement process exit cleanup handler** — Register handlers for `process.on('exit')` and `process.on('SIGINT')` that clear the spinner line, show the cursor, and clean up the interval timer. Remove handlers when spinner stops to avoid listener accumulation. | Status: done
- [x] **Implement disabled mode** — When `enabled` is false (explicit option, non-TTY auto-detection, or `AI_SPINNER_ENABLED=false`), all methods become no-ops that return `this`. No output is written. | Status: done
- [x] **Implement auto-cost calculation** — When a model is configured and pricing is available, automatically recalculate `metrics.cost` on each render cycle (or when tokens change) using the pricing lookup and cost calculation function. | Status: done

---

## Phase 10: Spinner Tests (`src/__tests__/spinner.test.ts`)

- [x] **Test createSpinner() returns idle state** — Verify `spinner.state === 'idle'` and `spinner.isActive === false` after creation. | Status: done
- [x] **Test start() transitions to waiting** — Verify `spinner.state === 'waiting'` and `spinner.isActive === true` after `start()`. | Status: done
- [x] **Test streaming() from waiting** — Verify `spinner.state === 'streaming'` after `start()` then `streaming()`. | Status: done
- [x] **Test toolCall() from waiting** — Verify `spinner.state === 'tool-calling'` after `start()` then `toolCall('search')`. | Status: done
- [x] **Test toolCall() from streaming** — Verify `spinner.state === 'tool-calling'` after `streaming()` then `toolCall('search')`. | Status: done
- [x] **Test rateLimited() from any active state** — Verify `spinner.state === 'rate-limited'` after `rateLimited(30)` from `waiting`, `streaming`, `tool-calling`. | Status: done
- [x] **Test processing() from streaming** — Verify `spinner.state === 'processing'` after `streaming()` then `processing()`. | Status: done
- [x] **Test succeed() from any active state** — Call `succeed()` from `waiting`, `streaming`, `tool-calling`, `rate-limited`, `processing`. Verify `spinner.state === 'complete'` in each case. | Status: done
- [x] **Test fail() from any active state** — Call `fail()` from `waiting`, `streaming`, `tool-calling`, `rate-limited`, `processing`. Verify `spinner.state === 'error'` in each case. | Status: done
- [x] **Test terminal states are terminal** — Verify `start()` from `complete` does not change state. Verify `start()` from `error` does not change state. | Status: done
- [x] **Test reset() from complete** — Verify `reset()` transitions from `complete` back to `idle` and clears all metrics. | Status: done
- [x] **Test reset() from error** — Verify `reset()` transitions from `error` back to `idle` and clears all metrics. | Status: done
- [x] **Test text property** — Set `spinner.text = 'New text'` and verify it reads back correctly. | Status: done
- [x] **Test method chaining** — Verify `spinner.start().streaming().addTokens(5).succeed()` works without errors and returns the spinner at each step. | Status: done
- [x] **Test disabled spinner** — Create with `enabled: false`. Call `start()`, `addTokens(10)`, `succeed()`. Verify no errors and no output to the stream. | Status: done
- [x] **Test elapsed time tracking** — Call `start()`, wait ~100ms, check `metrics.elapsedMs` is approximately 100. | Status: done
- [x] **Test TTFT measurement** — Call `start()`, wait ~200ms, call `streaming()`. Verify `metrics.ttftMs` is approximately 200. | Status: done
- [x] **Test TTFT not re-recorded** — Call `streaming()` twice. Verify `ttftMs` reflects the first call only. | Status: done

---

## Phase 11: Stream Integration (`src/stream.ts`)

- [x] **Implement wrapStream() function** — Accept an `AsyncIterable<unknown>`, an `AISpinner` instance, and `WrapStreamOptions`. Return a wrapped async iterable that observes chunks without buffering. Record `t_start` on entry. | Status: done
- [x] **Implement OpenAI stream adapter** — Detect OpenAI format (`choices[0].delta.content`). On first chunk with content: call `spinner.streaming()`. On each content chunk: call `spinner.addTokens(1)`. On final chunk with `usage` field: call `spinner.setInputTokens(usage.prompt_tokens)` and `spinner.update({ outputTokens: usage.completion_tokens })`. Yield every chunk unchanged. | Status: done
- [x] **Implement Anthropic stream adapter** — Detect Anthropic format (`event.type === 'content_block_delta'`). On first text delta: call `spinner.streaming()`. On each text delta: estimate tokens as `ceil(text.length / 4)` and call `spinner.addTokens()`. On `message_start`: extract `input_tokens`. On `message_delta`: correct output tokens from `usage.output_tokens`. Yield every event unchanged. | Status: done
- [x] **Implement generic stream adapter** — For unrecognized formats: treat each chunk as a string (`String(chunk)` or `JSON.stringify(chunk)`). On first chunk: call `spinner.streaming()`. Estimate tokens as `ceil(text.length / 4)` (minimum 1). Yield every chunk unchanged. | Status: done
- [x] **Implement auto-detection logic** — On the first chunk: check for `choices` array with `delta` property (OpenAI), check for `type` property matching Anthropic event types (Anthropic), otherwise fall back to generic. Lock the format after detection. | Status: done
- [x] **Implement TTFT measurement in wrapStream** — Record `performance.now()` when `wrapStream` is called. The TTFT is automatically captured when `spinner.streaming()` is called on the first chunk. | Status: done
- [x] **Ensure no auto-succeed/fail on stream end** — The wrapper must NOT call `succeed()` or `fail()` when the stream ends or errors. The caller retains control over terminal state transitions. | Status: done
- [x] **Ensure error propagation** — If the underlying stream throws an error, the wrapped stream must propagate that error to the consumer without catching or swallowing it. | Status: done
- [x] **Wire wrapStream into AISpinner class** — Add the `wrapStream<T>()` method to the `AISpinner` class that delegates to the stream module, passing `this` as the spinner instance. | Status: done

---

## Phase 12: Stream Tests (`src/__tests__/stream.test.ts`)

- 0
- 0
- 0
- 0
- 0
- 0
- 0
- 0
- 0

---

## Phase 13: Pipeline (`src/pipeline.ts`)

- [x] **Implement AIPipeline class constructor** — Accept `PipelineStepConfig[]` and `PipelineOptions`. Store step configurations. Initialize all steps as `pending`. Set `currentStep` to 0. Create the internal output stream and color settings. | Status: done
- [x] **Implement pipeline start()** — Begin the first step. Render all step lines (pending steps with dim dashes, active step with spinner). Start the spinner for the active step. | Status: done
- [x] **Implement pipeline next()** — Mark the current step as complete with its duration. Advance `currentStep`. If more steps remain, start the next step's spinner. If no more steps, enter the complete state. Accept optional completion text. | Status: done
- [x] **Implement pipeline fail()** — Mark the current step as failed. Stop the pipeline. Remaining steps stay as pending. Accept optional error text. | Status: done
- [x] **Implement pipeline complete()** — Mark all remaining steps as complete. Stop the pipeline. | Status: done
- [x] **Implement pipeline update()** — Update the current step's metrics or progress. Support `progress`, `text`, `tokens`, `cost`, `tps` fields. When a step has a `total`, display progress as `current/total`. | Status: done
- [x] **Implement pipeline addTokens()** — Proxy to the active step's internal spinner `addTokens()`. | Status: done
- [x] **Implement pipeline setCost()** — Proxy to the active step's cost tracking. | Status: done
- [x] **Implement pipeline setTPS()** — Proxy to the active step's TPS tracking. | Status: done
- [x] **Implement per-step duration tracking** — Track wall-clock time from step start to step completion. Display duration next to completed steps (e.g., `(0.3s)`). | Status: done
- [x] **Implement pipeline properties** — `currentStep` (0-based index), `totalSteps` (total count), `isComplete` (all done or failed). All read-only. | Status: done
- [x] **Implement multi-line TTY rendering** — On first render, print all step lines. On subsequent renders, use ANSI cursor movement (`\x1b[<n>A`) to move up to the active step's line and rewrite it. When a step completes, update its line and move to the next. | Status: done
- [x] **Implement non-TTY pipeline rendering** — In non-TTY mode, print each step's completion as a separate line with no cursor manipulation. Format: `[1/5] Step name... done (0.3s)`. | Status: done
- [x] **Implement step display format** — Each line: `<prefix> [<index>/<total>] <name>... <status> (<metrics>)`. Prefix: `✓` (complete), spinner char (active), `✗` (failed), `─` (pending). | Status: done
- [x] **Export createPipeline factory** — Export `createPipeline(steps, options?)` from `pipeline.ts`. Wire up the `index.ts` re-export. | Status: done

---

## Phase 14: Pipeline Tests (`src/__tests__/pipeline.test.ts`)

- [x] **Test pipeline creation** — `createPipeline([{name:'A'},{name:'B'},{name:'C'}])`: verify `totalSteps === 3`, `currentStep === 0`, `isComplete === false`. | Status: done
- [x] **Test pipeline start** — `pipeline.start()`: verify `currentStep === 0`. | Status: done
- [x] **Test pipeline next** — Call `next()` sequentially. Verify `currentStep` increments correctly. After last `next()`, verify `isComplete === true`. | Status: done
- [x] **Test pipeline complete** — Call `complete()` from step 1. Verify all remaining steps marked as complete and `isComplete === true`. | Status: done
- [x] **Test pipeline fail** — Call `fail('Error')` from step 1. Verify step 1 is failed, step 2 remains pending. | Status: done
- [x] **Test pipeline progress update** — Call `update({ progress: 47 })` on a step with `total: 100`. Verify the display includes `47/100`. | Status: done
- [x] **Test pipeline addTokens proxy** — Call `pipeline.addTokens(10)`. Verify token count is reflected in the active step. | Status: done
- [x] **Test pipeline setCost proxy** — Call `pipeline.setCost(0.005)`. Verify cost is reflected in the active step. | Status: done
- [x] **Test pipeline setTPS proxy** — Call `pipeline.setTPS(42.5)`. Verify TPS is reflected in the active step. | Status: done
- [x] **Test per-step duration** — Start a step, wait ~100ms, call `next()`. Verify the completed step's duration is approximately 100ms. | Status: done
- [x] **Test non-TTY pipeline output** — Use a non-TTY mock stream. Verify output contains no ANSI escape codes. Verify each step completion is printed as a separate line. | Status: done

---

## Phase 15: Public API Exports (`src/index.ts`)

- [x] **Export createSpinner** — Re-export the `createSpinner` factory function from `spinner.ts`. | Status: done
- [x] **Export createPipeline** — Re-export the `createPipeline` factory function from `pipeline.ts`. | Status: done
- [x] **Export all public types** — Re-export all public TypeScript types and interfaces from `types.ts`: `AISpinner`, `AIPipeline`, `SpinnerOptions`, `SpinnerState`, `SpinnerMetrics`, `SpinnerPreset`, `ModelPricing`, `StreamingOptions`, `ToolCallOptions`, `RateLimitOptions`, `WrapStreamOptions`, `PipelineStepConfig`, `PipelineOptions`, `PipelineUpdateData`. | Status: done

---

## Phase 16: Rendering Edge Cases & Polish

- [x] **Handle terminal resize** — On each render cycle, re-read `stream.columns` and truncate accordingly. Ensure no corruption if terminal is resized mid-render. | Status: done
- [x] **Handle rapid state transitions** — Ensure spinner handles fast transitions (e.g., `start()` -> `streaming()` -> `succeed()` in <1ms) without rendering artifacts or timer leaks. | Status: done
- [x] **Handle rate limit countdown edge cases** — Countdown reaching zero does not auto-transition state. Multiple consecutive `rateLimited()` calls reset the countdown. Countdown interval is cleaned up on state change. | Status: done
- [x] **Handle concurrent spinner warning** — Document (or warn) that two spinners on the same stream will produce corrupted output. Do not attempt multi-spinner coordination. | Status: done
- [x] **Handle long text truncation** — Very long text labels should be truncated cleanly with ellipsis, preserving metrics at the end of the line where possible. | Status: done
- [x] **Render loop cleanup guarantee** — Ensure `setInterval` timer is always cleared on `stop()`, `succeed()`, `fail()`, and the process exit handler. Verify no timer leaks in tests. | Status: done
- [x] **Handle stop() from idle** — `stop()` called before `start()` should be a safe no-op. | Status: done

---

## Phase 17: Rendering Tests (`src/__tests__/renderer.test.ts`)

- 0
- 0
- 0
- 0
- 0
- 0
- 0
- 0
- 0
- 0

---

## Phase 18: Integration Tests (`src/__tests__/integration.test.ts`)

- [x] **Test full spinner lifecycle with mock stream** — Create spinner, start, wrap a mock OpenAI stream, consume, succeed. Verify: all state transitions occurred, metrics are populated (tokens, TPS, TTFT, elapsed, cost), final output contains summary. | Status: done
- [x] **Test spinner with Anthropic mock stream** — Same as above but with Anthropic-format mock events. Verify token counting, input/output token extraction, TTFT. | Status: done
- [x] **Test spinner with rate limiting** — Start spinner, simulate 429, call `rateLimited(5)`, wait for countdown, call `start()` to retry, wrap new stream, succeed. Verify state transitions and countdown behavior. | Status: done
- [x] **Test spinner with tool calls** — Start spinner, call `toolCall('search', {index:1, total:2})`, call `toolCall('calc', {index:2, total:2})`, call `streaming()`, add tokens, succeed. Verify all state transitions. | Status: done
- [x] **Test pipeline end-to-end** — Create 3-step pipeline. Start, next through each step with progress updates and token additions. Complete. Verify all steps show correct status and durations. | Status: done
- [x] **Test disabled spinner end-to-end** — Create with `enabled: false`. Run full lifecycle. Verify no errors and zero bytes written to stream. | Status: done
- [x] **Test non-TTY end-to-end** — Create spinner with non-TTY mock stream. Run full lifecycle. Verify clean text output with no escape codes. | Status: done
- [x] **Test ora migration compatibility** — Verify `createSpinner({text}).start()` and `spinner.succeed(text)` work identically to the ora pattern. | Status: done

---

## Phase 19: Documentation

- [ ] **Write README.md** — Create README with: package description, installation instructions (`npm install ai-spinner`), quickstart example (streaming chatbot), API reference for `createSpinner` and `createPipeline`, all options documented, migration guide from `ora`, example use cases (rate limiting, tool calls, pipeline). | Status: not_done
- [ ] **Add JSDoc to all public methods** — Ensure every method on `AISpinner` and `AIPipeline` has complete JSDoc comments with `@param`, `@returns`, and usage examples. | Status: not_done
- [ ] **Add JSDoc to all public interfaces** — Ensure every field on `SpinnerOptions`, `SpinnerMetrics`, `PipelineOptions`, etc. has JSDoc with default values documented. | Status: not_done

---

## Phase 20: Build, Lint & Publish Readiness

- [x] **Verify npm run build passes** — Run `tsc` and confirm all source files compile without errors. Check that `dist/` contains `.js`, `.d.ts`, and `.d.ts.map` files for every source file. | Status: done
- [x] **Verify npm run lint passes** — Run ESLint across all source files. Fix any lint errors or warnings. | Status: done
- [x] **Verify npm run test passes** — Run Vitest and confirm all tests pass. No skipped or failing tests. | Status: done
- [x] **Verify package.json is complete** — Ensure `name`, `version`, `description`, `main`, `types`, `files`, `scripts`, `engines`, `license`, `keywords` are all correctly set. Add relevant keywords (e.g., `spinner`, `cli`, `terminal`, `ai`, `llm`, `progress`, `streaming`, `tokens`). | Status: done
- [x] **Verify zero runtime dependencies** — Confirm `package.json` has no `dependencies` field (only `devDependencies`). All functionality uses Node.js built-ins. | Status: done
- [x] **Verify TypeScript declarations** — Import `ai-spinner` types in a scratch file and confirm all public types are accessible and correctly typed. | Status: done
- [x] **Version bump** — Bump version to the appropriate semver version in `package.json` before publishing. | Status: done
