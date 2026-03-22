import { formatTokens, formatTPS, formatCost, formatElapsed, formatCountdown } from './format';
import type { SpinnerMetrics } from './types';

// ANSI escape codes
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

export const CURSOR_HIDE = '\x1b[?25l';
export const CURSOR_SHOW = '\x1b[?25h';
export const CLEAR_LINE = '\x1b[2K';
export const CR = '\r';

export function moveUp(n: number): string {
  return n > 0 ? `\x1b[${n}A` : '';
}

export function moveDown(n: number): string {
  return n > 0 ? `\x1b[${n}B` : '';
}

/**
 * Values to fill into a template.
 */
export interface TemplateValues {
  spinner?: string;
  symbol?: string;
  text?: string;
  tokens?: string;
  inputTokens?: string;
  outputTokens?: string;
  tps?: string;
  cost?: string;
  elapsed?: string;
  budget?: string;
  model?: string;
  ttft?: string;
  tool?: string;
  toolIndex?: string;
  countdown?: string;
}

/**
 * Build template values from metrics and state information.
 */
export function buildTemplateValues(opts: {
  spinnerFrame?: string;
  symbol?: string;
  text?: string;
  metrics: SpinnerMetrics;
  tokenBudget?: number;
  toolName?: string;
  toolIndex?: number;
  toolTotal?: number;
  showModel?: boolean;
  showElapsed?: boolean;
}): TemplateValues {
  const { metrics } = opts;
  const values: TemplateValues = {};

  if (opts.spinnerFrame !== undefined) values.spinner = opts.spinnerFrame;
  if (opts.symbol !== undefined) values.symbol = opts.symbol;
  if (opts.text !== undefined) values.text = opts.text;

  if (metrics.outputTokens > 0) {
    if (opts.tokenBudget) {
      values.tokens = `${metrics.outputTokens.toLocaleString('en-US')}/${opts.tokenBudget.toLocaleString('en-US')}`;
    } else {
      values.tokens = formatTokens(metrics.outputTokens);
    }
  }

  if (metrics.inputTokens > 0) {
    values.inputTokens = `${metrics.inputTokens.toLocaleString('en-US')} in`;
  }
  if (metrics.outputTokens > 0) {
    values.outputTokens = `${metrics.outputTokens.toLocaleString('en-US')} out`;
  }

  if (metrics.tps > 0) {
    values.tps = formatTPS(metrics.tps);
  }

  if (metrics.cost > 0) {
    values.cost = formatCost(metrics.cost);
  }

  if (metrics.elapsedMs > 0 && (opts.showElapsed || opts.symbol !== undefined)) {
    values.elapsed = formatElapsed(metrics.elapsedMs);
  }

  if (opts.tokenBudget && metrics.outputTokens > 0 && !values.tokens) {
    values.budget = `${metrics.outputTokens.toLocaleString('en-US')}/${opts.tokenBudget.toLocaleString('en-US')}`;
  }

  if (opts.showModel && metrics.model) {
    values.model = metrics.model;
  }

  if (metrics.ttftMs !== undefined && metrics.ttftMs > 0) {
    values.ttft = `TTFT: ${formatElapsed(metrics.ttftMs)}`;
  }

  if (opts.toolName) {
    values.tool = opts.toolName;
  }

  if (opts.toolIndex !== undefined && opts.toolTotal !== undefined) {
    values.toolIndex = `${opts.toolIndex}/${opts.toolTotal}`;
  }

  if (metrics.countdownSeconds !== undefined && metrics.countdownSeconds >= 0) {
    values.countdown = formatCountdown(metrics.countdownSeconds);
  }

  return values;
}

/**
 * Render a template string by substituting placeholder values.
 * Placeholders with no value are removed. Consecutive separators are collapsed.
 */
export function renderLine(template: string, values: TemplateValues): string {
  let result = template;

  // Replace each placeholder
  const placeholders: (keyof TemplateValues)[] = [
    'spinner', 'symbol', 'text', 'tokens', 'inputTokens', 'outputTokens',
    'tps', 'cost', 'elapsed', 'budget', 'model', 'ttft', 'tool',
    'toolIndex', 'countdown',
  ];

  for (const key of placeholders) {
    const placeholder = `{${key}}`;
    const value = values[key];
    result = result.split(placeholder).join(value ?? '');
  }

  // Collapse separators: remove dot-separators that are next to empty strings
  // This handles cases like "text  · · cost" -> "text · cost"
  result = result.replace(/(\s*·\s*)+/g, ' \u00b7 ');

  // Remove leading/trailing separators
  result = result.replace(/^\s*·\s*/, '');
  result = result.replace(/\s*·\s*$/, '');

  // Collapse multiple spaces
  result = result.replace(/\s{2,}/g, ' ');

  return result.trim();
}

/** Color element types for the ANSI coloring system. */
type ColorElement =
  | 'spinner'
  | 'success'
  | 'error'
  | 'rateLimit'
  | 'tps'
  | 'cost'
  | 'elapsed'
  | 'separator'
  | 'model';

const COLOR_MAP: Record<ColorElement, string> = {
  spinner: CYAN,
  success: GREEN,
  error: RED,
  rateLimit: YELLOW,
  tps: DIM,
  cost: YELLOW,
  elapsed: DIM,
  separator: DIM,
  model: DIM,
};

/**
 * Apply ANSI color to a string if colors are enabled.
 */
export function colorize(text: string, element: ColorElement, useColor: boolean): string {
  if (!useColor || !text) return text;
  return `${COLOR_MAP[element]}${text}${RESET}`;
}

/**
 * Apply colors to a fully rendered line.
 * This replaces known elements with their colored versions.
 */
export function applyColors(line: string, values: TemplateValues, useColor: boolean): string {
  if (!useColor) return line;

  let result = line;

  // Color the spinner frame
  if (values.spinner) {
    result = result.replace(values.spinner, colorize(values.spinner, 'spinner', true));
  }

  // Color the symbol (success = green, error = red)
  if (values.symbol) {
    if (values.symbol === '✓' || values.symbol === '✔') {
      result = result.replace(values.symbol, colorize(values.symbol, 'success', true));
    } else if (values.symbol === '✗' || values.symbol === '✘') {
      result = result.replace(values.symbol, colorize(values.symbol, 'error', true));
    } else if (values.symbol === '⏳') {
      result = result.replace(values.symbol, colorize(values.symbol, 'rateLimit', true));
    }
  }

  // Color TPS
  if (values.tps) {
    result = result.replace(values.tps, colorize(values.tps, 'tps', true));
  }

  // Color cost
  if (values.cost) {
    result = result.replace(values.cost, colorize(values.cost, 'cost', true));
  }

  // Color elapsed
  if (values.elapsed) {
    result = result.replace(values.elapsed, colorize(values.elapsed, 'elapsed', true));
  }

  // Color model
  if (values.model) {
    result = result.replace(values.model, colorize(values.model, 'model', true));
  }

  // Color separators
  result = result.replace(/·/g, colorize('·', 'separator', true));

  return result;
}

/**
 * Strip all ANSI escape codes from a string, returning its visual length.
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Truncate a line to fit within a given width, adding an ellipsis if needed.
 */
export function truncateLine(text: string, width: number): string {
  const plain = stripAnsi(text);
  if (plain.length <= width) return text;

  // We need to truncate the visible text to (width - 1) and add an ellipsis
  let visibleCount = 0;
  let i = 0;
  const target = width - 1;

  while (i < text.length && visibleCount < target) {
    // Check for ANSI escape sequence
    if (text[i] === '\x1b' && text[i + 1] === '[') {
      const end = text.indexOf('m', i);
      if (end !== -1) {
        i = end + 1;
        continue;
      }
    }
    visibleCount++;
    i++;
  }

  return text.slice(0, i) + '…' + RESET;
}

/**
 * Write a spinner line to a stream (TTY mode).
 */
export function writeLine(
  stream: NodeJS.WritableStream,
  text: string,
): void {
  stream.write(CLEAR_LINE + CR + text);
}

/**
 * Clear the current line on a stream.
 */
export function clearLine(stream: NodeJS.WritableStream): void {
  stream.write(CLEAR_LINE + CR);
}
