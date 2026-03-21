import type {
  AIPipeline,
  PipelineStepConfig,
  PipelineOptions,
  PipelineStep,
  PipelineUpdateData,
} from './types';
import { isTTY, supportsColor, getColumns } from './terminal';
import { getPreset, isPresetName } from './presets';
import { formatElapsed } from './format';
import {
  colorize,
  stripAnsi,
  truncateLine,
  CURSOR_HIDE,
  CURSOR_SHOW,
  CLEAR_LINE,
  CR,
  moveUp,
} from './renderer';

const DEFAULT_SUCCESS_SYMBOL = '✓';
const DEFAULT_FAIL_SYMBOL = '✗';
const DEFAULT_PENDING_SYMBOL = '─';

/**
 * AIPipeline implementation for multi-step progress tracking.
 */
class AIPipelineImpl implements AIPipeline {
  private _steps: PipelineStep[];
  private _currentStep = 0;
  private _isComplete = false;
  private _stream: NodeJS.WritableStream;
  private _isTTY: boolean;
  private _useColor: boolean;
  private _frames: string[];
  private _interval: number;
  private _showIndex: boolean;
  private _showDuration: boolean;
  private _renderTimer?: ReturnType<typeof setInterval>;
  private _frameIndex = 0;
  private _hasRendered = false;

  constructor(steps: PipelineStepConfig[], options: PipelineOptions = {}) {
    this._steps = steps.map((config) => ({
      config,
      status: 'pending' as const,
    }));

    this._stream = options.stream ?? process.stderr;
    this._isTTY = isTTY(this._stream);
    this._useColor = supportsColor(this._stream, options.color);
    this._showIndex = options.showIndex !== false;
    this._showDuration = options.showDuration !== false;

    if (Array.isArray(options.spinner)) {
      this._frames = options.spinner;
      this._interval = 80;
    } else {
      const preset = getPreset(
        isPresetName(options.spinner) ? options.spinner : 'dots',
      );
      this._frames = preset.frames;
      this._interval = preset.interval;
    }
  }

  get currentStep(): number {
    return this._currentStep;
  }

  get totalSteps(): number {
    return this._steps.length;
  }

  get isComplete(): boolean {
    return this._isComplete;
  }

  start(): AIPipeline {
    if (this._steps.length === 0) return this;

    this._steps[0].status = 'active';
    this._steps[0].startTime = performance.now();

    if (this._isTTY) {
      this._stream.write(CURSOR_HIDE);
      this._startRenderLoop();
    }

    return this;
  }

  next(text?: string): AIPipeline {
    if (this._isComplete) return this;
    if (this._currentStep >= this._steps.length) return this;

    // Complete current step
    const current = this._steps[this._currentStep];
    current.status = 'complete';
    current.endTime = performance.now();
    if (text !== undefined) current.text = text;

    // Non-TTY: print completed step
    if (!this._isTTY) {
      this._printStepLine(this._currentStep);
    }

    // Move to next step
    this._currentStep++;

    if (this._currentStep < this._steps.length) {
      const next = this._steps[this._currentStep];
      next.status = 'active';
      next.startTime = performance.now();
    } else {
      this._isComplete = true;
      this._stopRenderLoop();
      if (this._isTTY) {
        this._renderAll();
        this._stream.write('\n' + CURSOR_SHOW);
      }
    }

    return this;
  }

  fail(text?: string): AIPipeline {
    if (this._isComplete) return this;
    if (this._currentStep >= this._steps.length) return this;

    const current = this._steps[this._currentStep];
    current.status = 'failed';
    current.endTime = performance.now();
    if (text !== undefined) current.text = text;

    this._isComplete = true;
    this._stopRenderLoop();

    if (this._isTTY) {
      this._renderAll();
      this._stream.write('\n' + CURSOR_SHOW);
    } else {
      this._printStepLine(this._currentStep);
    }

    return this;
  }

  complete(text?: string): AIPipeline {
    if (this._isComplete) return this;

    // Complete current and all remaining steps
    for (let i = this._currentStep; i < this._steps.length; i++) {
      const step = this._steps[i];
      if (step.status === 'active' || step.status === 'pending') {
        step.status = 'complete';
        if (!step.endTime) step.endTime = performance.now();
        if (!step.startTime) step.startTime = step.endTime;
      }
    }

    if (text !== undefined && this._currentStep < this._steps.length) {
      this._steps[this._currentStep].text = text;
    }

    this._currentStep = this._steps.length;
    this._isComplete = true;
    this._stopRenderLoop();

    if (this._isTTY) {
      this._renderAll();
      this._stream.write('\n' + CURSOR_SHOW);
    } else {
      for (let i = 0; i < this._steps.length; i++) {
        if (this._steps[i].status === 'complete') {
          this._printStepLine(i);
        }
      }
    }

    return this;
  }

  update(data: PipelineUpdateData): AIPipeline {
    if (this._isComplete || this._currentStep >= this._steps.length) return this;

    const step = this._steps[this._currentStep];
    if (data.progress !== undefined) step.progress = data.progress;
    if (data.text !== undefined) step.text = data.text;
    if (data.tokens !== undefined) step.tokens = data.tokens;
    if (data.cost !== undefined) step.cost = data.cost;
    if (data.tps !== undefined) step.tps = data.tps;

    return this;
  }

  addTokens(count?: number): AIPipeline {
    if (this._isComplete || this._currentStep >= this._steps.length) return this;

    const step = this._steps[this._currentStep];
    step.tokens = (step.tokens ?? 0) + (count ?? 1);
    return this;
  }

  setCost(cost: number): AIPipeline {
    if (this._isComplete || this._currentStep >= this._steps.length) return this;
    this._steps[this._currentStep].cost = cost;
    return this;
  }

  setTPS(rate: number): AIPipeline {
    if (this._isComplete || this._currentStep >= this._steps.length) return this;
    this._steps[this._currentStep].tps = rate;
    return this;
  }

  // ── Private ──

  private _startRenderLoop(): void {
    this._stopRenderLoop();
    this._renderTimer = setInterval(() => {
      this._frameIndex++;
      this._renderAll();
    }, this._interval);
    this._renderAll();
  }

  private _stopRenderLoop(): void {
    if (this._renderTimer) {
      clearInterval(this._renderTimer);
      this._renderTimer = undefined;
    }
  }

  private _renderAll(): void {
    if (!this._isTTY) return;

    const cols = getColumns(this._stream);

    // If we've rendered before, move cursor up to the first line
    if (this._hasRendered) {
      this._stream.write(moveUp(this._steps.length));
    }

    for (let i = 0; i < this._steps.length; i++) {
      let line = this._buildStepLine(i);
      line = truncateLine(line, cols);
      this._stream.write(CLEAR_LINE + CR + line + '\n');
    }

    this._hasRendered = true;
  }

  private _buildStepLine(index: number): string {
    const step = this._steps[index];
    const total = this._steps.length;
    const num = index + 1;

    let prefix: string;
    let status = '';
    let metrics = '';

    switch (step.status) {
      case 'complete':
        prefix = this._useColor
          ? colorize(DEFAULT_SUCCESS_SYMBOL, 'success', true)
          : DEFAULT_SUCCESS_SYMBOL;
        status = 'done';
        if (this._showDuration && step.startTime && step.endTime) {
          metrics = `(${formatElapsed(step.endTime - step.startTime)})`;
        }
        break;

      case 'failed':
        prefix = this._useColor
          ? colorize(DEFAULT_FAIL_SYMBOL, 'error', true)
          : DEFAULT_FAIL_SYMBOL;
        status = step.text ?? 'failed';
        if (this._showDuration && step.startTime && step.endTime) {
          metrics = `(${formatElapsed(step.endTime - step.startTime)})`;
        }
        break;

      case 'active': {
        const frame = this._frames[this._frameIndex % this._frames.length];
        prefix = this._useColor
          ? colorize(frame, 'spinner', true)
          : frame;

        const parts: string[] = [];
        if (step.progress !== undefined && step.config.total !== undefined) {
          parts.push(`${step.progress}/${step.config.total}`);
        }
        if (step.tokens !== undefined && step.tokens > 0) {
          parts.push(`${step.tokens} tokens`);
        }
        if (step.tps !== undefined && step.tps > 0) {
          parts.push(`${step.tps.toFixed(1)} tok/s`);
        }
        if (step.cost !== undefined && step.cost > 0) {
          parts.push(`$${step.cost.toFixed(3)}`);
        }
        status = parts.join(' \u00b7 ');
        break;
      }

      case 'pending':
      default:
        prefix = this._useColor
          ? colorize(DEFAULT_PENDING_SYMBOL, 'model', true)
          : DEFAULT_PENDING_SYMBOL;
        break;
    }

    const indexPart = this._showIndex ? `[${num}/${total}] ` : '';
    const name = step.text && step.status === 'failed'
      ? `${step.config.name}...`
      : step.config.name + '...';
    const statusPart = status ? ` ${status}` : '';
    const metricsPart = metrics ? ` ${metrics}` : '';

    return `${prefix} ${indexPart}${name}${statusPart}${metricsPart}`;
  }

  private _printStepLine(index: number): void {
    const line = this._buildStepLine(index);
    // Strip ANSI for non-TTY
    const plainLine = this._isTTY ? line : stripAnsi(line);
    this._stream.write(plainLine + '\n');
  }
}

/**
 * Create a new AIPipeline instance.
 */
export function createPipeline(
  steps: PipelineStepConfig[],
  options?: PipelineOptions,
): AIPipeline {
  return new AIPipelineImpl(steps, options);
}
