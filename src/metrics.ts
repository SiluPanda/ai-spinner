import type { SpinnerMetrics } from './types';

interface TokenRecord {
  timestamp: number;
  count: number;
}

/**
 * Tracks spinner metrics including tokens, TPS (via sliding window), cost, and timing.
 */
export class MetricsTracker {
  private _outputTokens = 0;
  private _inputTokens = 0;
  private _tps = 0;
  private _cost = 0;
  private _model?: string;
  private _countdownSeconds?: number;
  private _startTime?: number;
  private _firstTokenTime?: number;
  private _tpsManuallySet = false;

  /** Sliding window for TPS calculation (last 20 records). */
  private _window: TokenRecord[] = [];
  private readonly _windowSize = 20;

  /**
   * Start the elapsed time timer.
   */
  startTimer(): void {
    this._startTime = performance.now();
  }

  /**
   * Record the time-to-first-token. Only records on the first call.
   */
  recordTTFT(): void {
    if (this._firstTokenTime !== undefined) return;
    this._firstTokenTime = performance.now();
  }

  /**
   * Add output tokens and update the TPS sliding window.
   */
  addTokens(count: number = 1): void {
    this._outputTokens += count;

    const now = performance.now();
    this._window.push({ timestamp: now, count });
    if (this._window.length > this._windowSize) {
      this._window.shift();
    }
    this._tps = this._calculateTPS();
  }

  /**
   * Set the input token count.
   */
  setInputTokens(count: number): void {
    this._inputTokens = count;
  }

  /**
   * Set the output token count directly (e.g., from API usage field).
   */
  setOutputTokens(count: number): void {
    this._outputTokens = count;
  }

  /**
   * Manually set TPS (overrides auto-calculated value).
   */
  setTPS(rate: number): void {
    this._tps = rate;
    this._tpsManuallySet = true;
  }

  /**
   * Manually set cost.
   */
  setCost(cost: number): void {
    this._cost = cost;
  }

  /**
   * Set the model name.
   */
  setModel(model: string): void {
    this._model = model;
  }

  /**
   * Set countdown seconds for rate limiting.
   */
  setCountdownSeconds(seconds: number): void {
    this._countdownSeconds = seconds;
  }

  /**
   * Decrement the countdown by 1 second. Returns the new value.
   */
  decrementCountdown(): number {
    if (this._countdownSeconds !== undefined && this._countdownSeconds > 0) {
      this._countdownSeconds--;
    }
    return this._countdownSeconds ?? 0;
  }

  /**
   * Clear the countdown.
   */
  clearCountdown(): void {
    this._countdownSeconds = undefined;
  }

  /**
   * Bulk-update metrics.
   */
  update(partial: Partial<SpinnerMetrics>): void {
    if (partial.outputTokens !== undefined) this._outputTokens = partial.outputTokens;
    if (partial.inputTokens !== undefined) this._inputTokens = partial.inputTokens;
    if (partial.tps !== undefined) {
      this._tps = partial.tps;
      this._tpsManuallySet = true;
    }
    if (partial.cost !== undefined) this._cost = partial.cost;
    if (partial.model !== undefined) this._model = partial.model;
    if (partial.countdownSeconds !== undefined) this._countdownSeconds = partial.countdownSeconds;
  }

  /**
   * Reset all metrics to initial values.
   */
  reset(): void {
    this._outputTokens = 0;
    this._inputTokens = 0;
    this._tps = 0;
    this._cost = 0;
    this._model = undefined;
    this._countdownSeconds = undefined;
    this._startTime = undefined;
    this._firstTokenTime = undefined;
    this._tpsManuallySet = false;
    this._window = [];
  }

  /**
   * Get a readonly snapshot of the current metrics.
   */
  getMetrics(): SpinnerMetrics {
    const elapsedMs =
      this._startTime !== undefined ? performance.now() - this._startTime : 0;

    const ttftMs =
      this._firstTokenTime !== undefined && this._startTime !== undefined
        ? this._firstTokenTime - this._startTime
        : undefined;

    return {
      outputTokens: this._outputTokens,
      inputTokens: this._inputTokens,
      tps: this._tps,
      cost: this._cost,
      elapsedMs,
      ttftMs,
      model: this._model,
      countdownSeconds: this._countdownSeconds,
    };
  }

  /**
   * Calculate TPS from the sliding window.
   */
  private _calculateTPS(): number {
    if (this._tpsManuallySet) return this._tps;
    if (this._window.length < 2) return 0;

    const first = this._window[0];
    const last = this._window[this._window.length - 1];
    const timeSpanMs = last.timestamp - first.timestamp;

    if (timeSpanMs <= 0) return 0;

    const totalTokens = this._window.reduce((sum, r) => sum + r.count, 0);
    const timeSpanSeconds = timeSpanMs / 1000;
    return totalTokens / timeSpanSeconds;
  }
}
