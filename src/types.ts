/**
 * All possible spinner states.
 */
export type SpinnerState =
  | 'idle'
  | 'waiting'
  | 'streaming'
  | 'tool-calling'
  | 'rate-limited'
  | 'processing'
  | 'complete'
  | 'error';

/**
 * Named spinner animation presets.
 */
export type SpinnerPreset = 'dots' | 'line' | 'arc' | 'arrow' | 'bounce';

/**
 * Pricing data for a model (cost per million tokens).
 */
export interface ModelPricing {
  /** Cost per million input tokens in dollars. */
  inputCostPerMillion: number;
  /** Cost per million output tokens in dollars. */
  outputCostPerMillion: number;
}

/**
 * Format templates for various spinner states.
 */
export interface FormatOptions {
  /** Format template for the streaming state. Default: '{spinner} {text} {tokens} · {tps} · {cost}' */
  streamingFormat?: string;
  /** Format template for the completion state. Default: '{symbol} {text} · {tokens} · {elapsed} · {cost}' */
  completeFormat?: string;
  /** Format template for the waiting state. Default: '{spinner} {text}' */
  waitingFormat?: string;
  /** Format template for the error state. Default: '{symbol} {text}' */
  errorFormat?: string;
}

/**
 * Custom symbols for spinner states.
 */
export interface SymbolOptions {
  /** Symbol for success state. Default: '✓' */
  successSymbol?: string;
  /** Symbol for error state. Default: '✗' */
  failSymbol?: string;
  /** Symbol for rate-limited state. Default: '⏳' */
  rateLimitSymbol?: string;
}

/**
 * Options for creating an AISpinner.
 */
export interface SpinnerOptions extends FormatOptions, SymbolOptions {
  /** Initial text label. Default: 'Working...' */
  text?: string;
  /** Spinner animation frames — a preset name or custom frame array. Default: 'dots' */
  spinner?: SpinnerPreset | string[];
  /** Animation frame interval in milliseconds. Default: 80 */
  interval?: number;
  /** Output stream. Default: process.stderr */
  stream?: NodeJS.WritableStream;
  /** Whether to use ANSI colors. Auto-detected by default. */
  color?: boolean;
  /** LLM model name for cost estimation and display. */
  model?: string;
  /** Custom model pricing, overrides built-in pricing. */
  pricing?: ModelPricing;
  /** Maximum output tokens (token budget). */
  tokenBudget?: number;
  /** Whether to show the model name. Default: false */
  showModel?: boolean;
  /** Whether to show elapsed time during streaming. Default: false */
  showElapsed?: boolean;
  /** Whether the spinner is enabled. Default: auto-detected from TTY. */
  enabled?: boolean;
}

/**
 * Snapshot of current spinner metrics.
 */
export interface SpinnerMetrics {
  outputTokens: number;
  inputTokens: number;
  tps: number;
  cost: number;
  elapsedMs: number;
  ttftMs?: number;
  model?: string;
  countdownSeconds?: number;
}

/**
 * Options for the streaming() transition.
 */
export interface StreamingOptions {
  text?: string;
  model?: string;
  inputTokens?: number;
}

/**
 * Options for the toolCall() transition.
 */
export interface ToolCallOptions {
  index?: number;
  total?: number;
}

/**
 * Options for the rateLimited() transition.
 */
export interface RateLimitOptions {
  reason?: string;
  statusCode?: number;
}

/**
 * Options for wrapStream().
 */
export interface WrapStreamOptions {
  text?: string;
  model?: string;
  inputTokens?: number;
  format?: 'openai' | 'anthropic' | 'text' | 'auto';
}

/**
 * The AISpinner public interface.
 */
export interface AISpinner {
  // ── Lifecycle ──
  start(text?: string): AISpinner;
  stop(): AISpinner;
  reset(): AISpinner;

  // ── State Transitions ──
  streaming(options?: StreamingOptions): AISpinner;
  toolCall(toolName: string, options?: ToolCallOptions): AISpinner;
  rateLimited(seconds: number, options?: RateLimitOptions): AISpinner;
  processing(text?: string): AISpinner;
  succeed(text?: string): AISpinner;
  fail(text?: string): AISpinner;

  // ── Metric Updates ──
  addTokens(count?: number): AISpinner;
  setInputTokens(count: number): AISpinner;
  setTPS(rate: number): AISpinner;
  setCost(cost: number): AISpinner;
  update(metrics: Partial<SpinnerMetrics>): AISpinner;

  // ── Stream Integration ──
  wrapStream<T>(stream: AsyncIterable<T>, options?: WrapStreamOptions): AsyncIterable<T>;

  // ── Properties ──
  text: string;
  readonly state: SpinnerState;
  readonly metrics: Readonly<SpinnerMetrics>;
  readonly isActive: boolean;
}

/**
 * Configuration for a single pipeline step.
 */
export interface PipelineStepConfig {
  name: string;
  total?: number;
  model?: string;
}

/**
 * Options for creating an AIPipeline.
 */
export interface PipelineOptions {
  stream?: NodeJS.WritableStream;
  color?: boolean;
  spinner?: SpinnerPreset | string[];
  showIndex?: boolean;
  showDuration?: boolean;
}

/**
 * Internal state of a pipeline step.
 */
export type PipelineStepStatus = 'pending' | 'active' | 'complete' | 'failed';

/**
 * Internal representation of a pipeline step.
 */
export interface PipelineStep {
  config: PipelineStepConfig;
  status: PipelineStepStatus;
  startTime?: number;
  endTime?: number;
  progress?: number;
  tokens?: number;
  cost?: number;
  tps?: number;
  text?: string;
}

/**
 * Data for updating a pipeline step.
 */
export interface PipelineUpdateData {
  progress?: number;
  text?: string;
  tokens?: number;
  cost?: number;
  tps?: number;
}

/**
 * The AIPipeline public interface.
 */
export interface AIPipeline {
  start(): AIPipeline;
  next(text?: string): AIPipeline;
  fail(text?: string): AIPipeline;
  complete(text?: string): AIPipeline;
  update(data: PipelineUpdateData): AIPipeline;
  addTokens(count?: number): AIPipeline;
  setCost(cost: number): AIPipeline;
  setTPS(rate: number): AIPipeline;

  readonly currentStep: number;
  readonly totalSteps: number;
  readonly isComplete: boolean;
}
