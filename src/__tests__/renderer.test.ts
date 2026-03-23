import { describe, it, expect } from 'vitest';
import {
  renderLine,
  buildTemplateValues,
  colorize,
  applyColors,
  stripAnsi,
  truncateLine,
  CURSOR_HIDE,
  CURSOR_SHOW,
  CLEAR_LINE,
  CR,
} from '../renderer';
import type { SpinnerMetrics } from '../types';

function makeMetrics(overrides?: Partial<SpinnerMetrics>): SpinnerMetrics {
  return {
    outputTokens: 0,
    inputTokens: 0,
    tps: 0,
    cost: 0,
    elapsedMs: 0,
    ...overrides,
  };
}

describe('renderer', () => {
  // ── 1. TTY escape codes ──────────────────────────────────────────────
  describe('TTY escape codes', () => {
    it('CURSOR_HIDE, CURSOR_SHOW, CLEAR_LINE, CR are defined escape sequences', () => {
      expect(CURSOR_HIDE).toBe('\x1b[?25l');
      expect(CURSOR_SHOW).toBe('\x1b[?25h');
      expect(CLEAR_LINE).toBe('\x1b[2K');
      expect(CR).toBe('\r');
    });
  });

  // ── 2. non-TTY mode (stripAnsi) ─────────────────────────────────────
  describe('non-TTY mode', () => {
    it('stripAnsi removes all ANSI escape codes', () => {
      const colored = '\x1b[36m\u280B\x1b[0m Working... \x1b[2m42.0 tok/s\x1b[0m';
      expect(stripAnsi(colored)).toBe('\u280B Working... 42.0 tok/s');
    });

    it('stripAnsi returns plain text unchanged', () => {
      expect(stripAnsi('plain text')).toBe('plain text');
    });
  });

  // ── 3 & 4. color output ─────────────────────────────────────────────
  describe('color output', () => {
    it('colorize adds ANSI codes when useColor=true', () => {
      const result = colorize('\u280B', 'spinner', true);
      expect(result).toContain('\x1b[36m'); // cyan
      expect(result).toContain('\x1b[0m');  // reset
      expect(stripAnsi(result)).toBe('\u280B');
    });

    it('colorize returns plain text when useColor=false', () => {
      const result = colorize('\u280B', 'spinner', false);
      expect(result).toBe('\u280B');
      expect(result).not.toContain('\x1b[');
    });
  });

  // ── 5 & 6. applyColors ──────────────────────────────────────────────
  describe('applyColors', () => {
    it('applyColors adds ANSI codes to known elements', () => {
      const values = buildTemplateValues({
        spinnerFrame: '\u280B',
        text: 'Working...',
        metrics: makeMetrics({ outputTokens: 100, tps: 42.5, cost: 0.005 }),
      });
      const line = renderLine('{spinner} {text} \u00b7 {tokens} \u00b7 {tps} \u00b7 {cost}', values);
      const colored = applyColors(line, values, true);

      expect(colored).toContain('\x1b['); // has ANSI codes
      expect(stripAnsi(colored)).toBe(stripAnsi(line)); // visual content same
    });

    it('applyColors returns unchanged string when useColor=false', () => {
      const values = buildTemplateValues({
        spinnerFrame: '\u280B',
        text: 'Working...',
        metrics: makeMetrics({ outputTokens: 100 }),
      });
      const line = renderLine('{spinner} {text} \u00b7 {tokens}', values);
      const noColor = applyColors(line, values, false);

      expect(noColor).toBe(line);
      expect(noColor).not.toContain('\x1b[');
    });
  });

  // ── 7. line truncation ──────────────────────────────────────────────
  describe('line truncation', () => {
    it('truncates line to specified width with ellipsis', () => {
      const longText = 'A'.repeat(100);
      const result = truncateLine(longText, 40);
      expect(stripAnsi(result).length).toBeLessThanOrEqual(40);
      expect(stripAnsi(result)).toContain('\u2026');
    });

    it('does not truncate lines shorter than width', () => {
      const shortText = 'Hello world';
      expect(truncateLine(shortText, 80)).toBe(shortText);
    });

    it('handles truncation of colored text correctly', () => {
      const colored = '\x1b[36m' + 'A'.repeat(100) + '\x1b[0m';
      const result = truncateLine(colored, 40);
      // Visual length should be <= 40
      expect(stripAnsi(result).length).toBeLessThanOrEqual(40);
    });
  });

  // ── 8, 9, 10. template rendering ───────────────────────────────────
  describe('template rendering', () => {
    it('renders template with placeholders substituted', () => {
      const values = buildTemplateValues({
        spinnerFrame: '\u280B',
        text: 'Working...',
        metrics: makeMetrics({ outputTokens: 142 }),
      });
      const result = renderLine('{spinner} {text} \u00b7 {tokens}', values);
      expect(result).toContain('\u280B');
      expect(result).toContain('Working...');
      expect(result).toContain('142 tokens');
    });

    it('collapses separators when placeholders are omitted', () => {
      const values = buildTemplateValues({
        spinnerFrame: '\u280B',
        text: 'Working...',
        metrics: makeMetrics({ outputTokens: 142, cost: 0 }), // cost=0 produces no value
      });
      const result = renderLine('{spinner} {text} \u00b7 {tokens} \u00b7 {cost}', values);

      // Should NOT have trailing separator or double separator
      expect(result).not.toMatch(/\u00b7\s*$/);
      expect(result).not.toMatch(/\u00b7\s*\u00b7/);
      expect(result).toContain('142 tokens');
    });

    it('removes all separators when only text remains', () => {
      const values = buildTemplateValues({
        spinnerFrame: '\u280B',
        text: 'Working...',
        metrics: makeMetrics(), // all zeros — no tokens, tps, cost
      });
      const result = renderLine('{spinner} {text} \u00b7 {tokens} \u00b7 {tps} \u00b7 {cost}', values);

      expect(result).not.toContain('\u00b7');
      expect(result).toContain('\u280B');
      expect(result).toContain('Working...');
    });

    it('renders complete format with symbol, text, tokens, and elapsed', () => {
      const values = buildTemplateValues({
        symbol: '\u2713',
        text: 'Done',
        metrics: makeMetrics({ outputTokens: 142, elapsedMs: 2134 }),
        showElapsed: true,
      });
      const result = renderLine('{symbol} {text} \u00b7 {tokens} \u00b7 {elapsed}', values);

      expect(result).toContain('\u2713');
      expect(result).toContain('Done');
      expect(result).toContain('142 tokens');
      expect(result).toContain('2.1s');
    });
  });
});
