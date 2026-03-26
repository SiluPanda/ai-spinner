import type {
  AISpinner,
  SpinnerOptions,
  SpinnerState,
  SpinnerMetrics,
  StreamingOptions,
  ToolCallOptions,
  RateLimitOptions,
  WrapStreamOptions,
} from './types';
import { getPreset, isPresetName } from './presets';
import { isTTY, supportsColor, getColumns, isEnabledByEnv } from './terminal';
import { MetricsTracker } from './metrics';
import { getModelPricing, calculateCost } from './pricing';
import {
  buildTemplateValues,
  renderLine,
  applyColors,
  truncateLine,
  writeLine,
  clearLine,
  CURSOR_HIDE,
  CURSOR_SHOW,
} from './renderer';
import { wrapStream as wrapStreamImpl } from './stream';

const ACTIVE_STATES: Set<SpinnerState> = new Set([
  'waiting',
  'streaming',
  'tool-calling',
  'rate-limited',
  'processing',
]);

const DEFAULT_TEXT = 'Working...';
const DEFAULT_SUCCESS_SYMBOL = '✓';
const DEFAULT_FAIL_SYMBOL = '✗';
const DEFAULT_RATE_LIMIT_SYMBOL = '⏳';

const DEFAULT_STREAMING_FORMAT = '{spinner} {text} {tokens} · {tps} · {cost}';
const DEFAULT_COMPLETE_FORMAT = '{symbol} {text} · {tokens} · {elapsed} · {cost}';
const DEFAULT_WAITING_FORMAT = '{spinner} {text}';
const DEFAULT_ERROR_FORMAT = '{symbol} {text}';
const DEFAULT_TOOL_CALLING_FORMAT = '{spinner} Running {tool}...';
const DEFAULT_TOOL_CALLING_INDEX_FORMAT = '{spinner} Running {tool}... (tool {toolIndex})';
const DEFAULT_RATE_LIMITED_FORMAT = '{symbol} Rate limited · retrying in {countdown}';

/**
 * Core AISpinner implementation.
 */
class AISpinnerImpl implements AISpinner {
  private _state: SpinnerState = 'idle';
  private _text: string;
  private _frames: string[];
  private _interval: number;
  private _stream: NodeJS.WritableStream;
  private _useColor: boolean;
  private _isTTY: boolean;
  private _enabled: boolean;
  private _model?: string;
  private _pricing?: import('./types').ModelPricing;
  private _tokenBudget?: number;
  private _showModel: boolean;
  private _showElapsed: boolean;
  private _successSymbol: string;
  private _failSymbol: string;
  private _rateLimitSymbol: string;
  private _streamingFormat: string;
  private _completeFormat: string;
  private _waitingFormat: string;
  private _errorFormat: string;

  private _metrics: MetricsTracker;
  private _frameIndex = 0;
  private _renderTimer?: ReturnType<typeof setInterval>;
  private _countdownTimer?: ReturnType<typeof setInterval>;
  private _toolName?: string;
  private _toolIndex?: number;
  private _toolTotal?: number;

  private _exitHandler?: () => void;
  private _sigintHandler?: () => void;

  constructor(options: SpinnerOptions = {}) {
    this._text = options.text ?? DEFAULT_TEXT;

    // Resolve spinner frames
    if (Array.isArray(options.spinner)) {
      this._frames = options.spinner;
      this._interval = options.interval ?? 80;
    } else {
      const preset = getPreset(
        isPresetName(options.spinner) ? options.spinner : 'dots',
      );
      this._frames = preset.frames;
      this._interval = options.interval ?? preset.interval;
    }

    this._stream = options.stream ?? process.stderr;
    this._isTTY = isTTY(this._stream);
    this._useColor = supportsColor(this._stream, options.color);
    this._model = options.model;
    this._pricing = options.pricing;
    this._tokenBudget = options.tokenBudget;
    this._showModel = options.showModel ?? false;
    this._showElapsed = options.showElapsed ?? false;
    this._successSymbol = options.successSymbol ?? DEFAULT_SUCCESS_SYMBOL;
    this._failSymbol = options.failSymbol ?? DEFAULT_FAIL_SYMBOL;
    this._rateLimitSymbol = options.rateLimitSymbol ?? DEFAULT_RATE_LIMIT_SYMBOL;
    this._streamingFormat = options.streamingFormat ?? DEFAULT_STREAMING_FORMAT;
    this._completeFormat = options.completeFormat ?? DEFAULT_COMPLETE_FORMAT;
    this._waitingFormat = options.waitingFormat ?? DEFAULT_WAITING_FORMAT;
    this._errorFormat = options.errorFormat ?? DEFAULT_ERROR_FORMAT;

    this._metrics = new MetricsTracker();

    // Determine enabled state
    const envEnabled = isEnabledByEnv();
    if (options.enabled !== undefined) {
      this._enabled = options.enabled;
    } else if (envEnabled !== undefined) {
      this._enabled = envEnabled;
    } else {
      this._enabled = this._isTTY;
    }

    if (this._model) {
      this._metrics.setModel(this._model);
    }
  }

  // ── Properties ──

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    this._text = value;
  }

  get state(): SpinnerState {
    return this._state;
  }

  get metrics(): Readonly<SpinnerMetrics> {
    return this._getMetricsSnapshot();
  }

  get isActive(): boolean {
    return ACTIVE_STATES.has(this._state);
  }

  // ── Lifecycle ──

  start(text?: string): AISpinner {
    if (!this._enabled) return this;
    if (this._state === 'complete' || this._state === 'error') return this;

    if (text !== undefined) this._text = text;
    this._state = 'waiting';
    this._metrics.startTimer();
    this._startRenderLoop();
    this._removeCleanupHandlers();
    this._registerCleanupHandlers();

    if (this._isTTY) {
      this._stream.write(CURSOR_HIDE);
    }

    return this;
  }

  stop(): AISpinner {
    if (!this._enabled) return this;
    this._stopRenderLoop();
    this._stopCountdown();

    if (this._isTTY) {
      clearLine(this._stream);
      this._stream.write(CURSOR_SHOW);
    }

    this._removeCleanupHandlers();
    return this;
  }

  reset(): AISpinner {
    this.stop();
    this._state = 'idle';
    this._metrics.reset();
    this._frameIndex = 0;
    this._toolName = undefined;
    this._toolIndex = undefined;
    this._toolTotal = undefined;
    return this;
  }

  // ── State Transitions ──

  streaming(options?: StreamingOptions): AISpinner {
    if (!this._enabled) return this;
    if (!this._isActiveState()) return this;

    const wasWaiting = this._state === 'waiting';
    this._state = 'streaming';

    if (wasWaiting) {
      this._metrics.recordTTFT();
    }

    if (options?.text !== undefined) this._text = options.text;
    if (options?.model !== undefined) {
      this._model = options.model;
      this._metrics.setModel(options.model);
    }
    if (options?.inputTokens !== undefined) {
      this._metrics.setInputTokens(options.inputTokens);
    }

    return this;
  }

  toolCall(toolName: string, options?: ToolCallOptions): AISpinner {
    if (!this._enabled) return this;
    if (!this._isActiveState()) return this;

    this._state = 'tool-calling';
    this._toolName = toolName;
    this._toolIndex = options?.index;
    this._toolTotal = options?.total;
    return this;
  }

  rateLimited(seconds: number, options?: RateLimitOptions): AISpinner {
    if (!this._enabled) return this;
    if (!this._isActiveState()) return this;

    this._state = 'rate-limited';
    this._metrics.setCountdownSeconds(seconds);
    this._stopCountdown();

    // Start countdown timer
    this._countdownTimer = setInterval(() => {
      const remaining = this._metrics.decrementCountdown();
      if (remaining <= 0) {
        this._stopCountdown();
      }
    }, 1000);
    if (this._countdownTimer.unref) this._countdownTimer.unref();

    // Store reason for display if provided
    if (options?.reason) {
      this._text = `Rate limited (${options.reason})`;
    } else {
      this._text = 'Rate limited';
    }

    return this;
  }

  processing(text?: string): AISpinner {
    if (!this._enabled) return this;
    if (!this._isActiveState()) return this;

    this._state = 'processing';
    if (text !== undefined) this._text = text;
    return this;
  }

  succeed(text?: string): AISpinner {
    if (!this._enabled) return this;
    if (!this._isActiveState()) return this;

    this._state = 'complete';
    if (text !== undefined) this._text = text;
    this._finalize(this._successSymbol, this._completeFormat);
    return this;
  }

  fail(text?: string): AISpinner {
    if (!this._enabled) return this;
    if (!this._isActiveState()) return this;

    this._state = 'error';
    if (text !== undefined) this._text = text;
    this._finalize(this._failSymbol, this._errorFormat);
    return this;
  }

  // ── Metric Updates ──

  addTokens(count?: number): AISpinner {
    if (!this._enabled) return this;
    this._metrics.addTokens(count ?? 1);
    return this;
  }

  setInputTokens(count: number): AISpinner {
    if (!this._enabled) return this;
    this._metrics.setInputTokens(count);
    return this;
  }

  setTPS(rate: number): AISpinner {
    if (!this._enabled) return this;
    this._metrics.setTPS(rate);
    return this;
  }

  setCost(cost: number): AISpinner {
    if (!this._enabled) return this;
    this._metrics.setCost(cost);
    return this;
  }

  update(metrics: Partial<SpinnerMetrics>): AISpinner {
    if (!this._enabled) return this;
    this._metrics.update(metrics);
    return this;
  }

  // ── Stream Integration ──

  wrapStream<T>(stream: AsyncIterable<T>, options?: WrapStreamOptions): AsyncIterable<T> {
    return wrapStreamImpl(stream, this, options);
  }

  // ── Private Methods ──

  private _isActiveState(): boolean {
    return ACTIVE_STATES.has(this._state);
  }

  private _getMetricsSnapshot(): SpinnerMetrics {
    const m = this._metrics.getMetrics();
    // Auto-calculate cost if model pricing is available
    if (this._model && !m.cost) {
      const pricing = getModelPricing(this._model, this._pricing);
      if (pricing) {
        m.cost = calculateCost(m.inputTokens, m.outputTokens, pricing);
      }
    }
    return m;
  }

  private _startRenderLoop(): void {
    this._stopRenderLoop();
    this._renderTimer = setInterval(() => this._render(), this._interval);
    if (this._renderTimer.unref) this._renderTimer.unref();
    // Render immediately
    this._render();
  }

  private _stopRenderLoop(): void {
    if (this._renderTimer) {
      clearInterval(this._renderTimer);
      this._renderTimer = undefined;
    }
  }

  private _stopCountdown(): void {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = undefined;
    }
  }

  private _render(): void {
    if (!this._isTTY) return; // Non-TTY: no live rendering

    const frame = this._frames[this._frameIndex % this._frames.length];
    this._frameIndex++;

    const metricsSnapshot = this._getMetricsSnapshot();
    const template = this._getTemplateForState();

    let symbol: string | undefined;
    if (this._state === 'rate-limited') {
      symbol = this._rateLimitSymbol;
    }

    const values = buildTemplateValues({
      spinnerFrame: frame,
      symbol,
      text: this._text,
      metrics: metricsSnapshot,
      tokenBudget: this._tokenBudget,
      toolName: this._toolName,
      toolIndex: this._toolIndex,
      toolTotal: this._toolTotal,
      showModel: this._showModel,
      showElapsed: this._showElapsed,
    });

    let line = renderLine(template, values);
    line = applyColors(line, values, this._useColor);

    const cols = getColumns(this._stream);
    line = truncateLine(line, cols);

    writeLine(this._stream, line);
  }

  private _getTemplateForState(): string {
    switch (this._state) {
      case 'waiting':
        return this._waitingFormat;
      case 'streaming':
        return this._streamingFormat;
      case 'tool-calling':
        if (this._toolIndex !== undefined && this._toolTotal !== undefined) {
          return DEFAULT_TOOL_CALLING_INDEX_FORMAT;
        }
        return DEFAULT_TOOL_CALLING_FORMAT;
      case 'rate-limited':
        return DEFAULT_RATE_LIMITED_FORMAT;
      case 'processing':
        return this._waitingFormat; // Same format as waiting
      default:
        return this._waitingFormat;
    }
  }

  private _finalize(symbol: string, format: string): void {
    this._stopRenderLoop();
    this._stopCountdown();

    const metricsSnapshot = this._getMetricsSnapshot();

    const values = buildTemplateValues({
      symbol,
      text: this._text,
      metrics: metricsSnapshot,
      tokenBudget: this._tokenBudget,
      showModel: this._showModel,
      showElapsed: true, // Always show elapsed in final line
    });

    let line = renderLine(format, values);

    if (this._isTTY) {
      line = applyColors(line, values, this._useColor);
      clearLine(this._stream);
      this._stream.write(line + '\n');
      this._stream.write(CURSOR_SHOW);
    } else {
      // Non-TTY: print plain text summary
      this._stream.write(line + '\n');
    }

    this._removeCleanupHandlers();
  }

  private _registerCleanupHandlers(): void {
    this._exitHandler = () => {
      if (this._isTTY) {
        clearLine(this._stream);
        this._stream.write(CURSOR_SHOW);
      }
      this._stopRenderLoop();
      this._stopCountdown();
    };

    this._sigintHandler = () => {
      if (this._exitHandler) this._exitHandler();
      process.exit(130);
    };

    process.on('exit', this._exitHandler);
    process.on('SIGINT', this._sigintHandler);
  }

  private _removeCleanupHandlers(): void {
    if (this._exitHandler) {
      process.removeListener('exit', this._exitHandler);
      this._exitHandler = undefined;
    }
    if (this._sigintHandler) {
      process.removeListener('SIGINT', this._sigintHandler);
      this._sigintHandler = undefined;
    }
  }
}

/**
 * Create a new AISpinner instance.
 */
export function createSpinner(options?: SpinnerOptions): AISpinner {
  return new AISpinnerImpl(options);
}
