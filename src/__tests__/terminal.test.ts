import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isTTY, isCI, supportsColor, getColumns, isEnabledByEnv } from '../terminal';
import { Writable } from 'stream';

function createMockStream(options: { isTTY?: boolean; columns?: number } = {}): NodeJS.WritableStream {
  const stream = new Writable({
    write(_chunk, _enc, cb) { cb(); },
  }) as NodeJS.WritableStream & { isTTY?: boolean; columns?: number };
  if (options.isTTY !== undefined) (stream as any).isTTY = options.isTTY;
  if (options.columns !== undefined) (stream as any).columns = options.columns;
  return stream;
}

describe('isTTY', () => {
  it('returns true when stream.isTTY is true', () => {
    expect(isTTY(createMockStream({ isTTY: true }))).toBe(true);
  });

  it('returns false when stream.isTTY is false', () => {
    expect(isTTY(createMockStream({ isTTY: false }))).toBe(false);
  });

  it('returns false when stream.isTTY is undefined', () => {
    expect(isTTY(createMockStream())).toBe(false);
  });

  it('returns false when stream is undefined', () => {
    expect(isTTY(undefined)).toBe(false);
  });
});

describe('isCI', () => {


  beforeEach(() => {
    vi.stubEnv('CI', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when CI=true', () => {
    vi.stubEnv('CI', 'true');
    expect(isCI()).toBe(true);
  });

  it('returns true when CI=1', () => {
    vi.stubEnv('CI', '1');
    expect(isCI()).toBe(true);
  });

  it('returns false when CI is not set', () => {
    delete process.env.CI;
    expect(isCI()).toBe(false);
  });

  it('returns false when CI=false', () => {
    vi.stubEnv('CI', 'false');
    expect(isCI()).toBe(false);
  });

  it('returns false when CI=0', () => {
    vi.stubEnv('CI', '0');
    expect(isCI()).toBe(false);
  });

  it('returns false when CI is empty string', () => {
    vi.stubEnv('CI', '');
    expect(isCI()).toBe(false);
  });
});

describe('supportsColor', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns explicit option when provided (true)', () => {
    expect(supportsColor(createMockStream(), true)).toBe(true);
  });

  it('returns explicit option when provided (false)', () => {
    expect(supportsColor(createMockStream({ isTTY: true }), false)).toBe(false);
  });

  it('returns true when FORCE_COLOR=1', () => {
    vi.stubEnv('FORCE_COLOR', '1');
    expect(supportsColor(createMockStream())).toBe(true);
  });

  it('returns false when FORCE_COLOR=0', () => {
    vi.stubEnv('FORCE_COLOR', '0');
    expect(supportsColor(createMockStream({ isTTY: true }))).toBe(false);
  });

  it('returns false when NO_COLOR is set', () => {
    vi.stubEnv('NO_COLOR', '1');
    expect(supportsColor(createMockStream({ isTTY: true }))).toBe(false);
  });

  it('returns false when TERM=dumb', () => {
    vi.stubEnv('TERM', 'dumb');
    expect(supportsColor(createMockStream({ isTTY: true }))).toBe(false);
  });

  it('returns true for TTY stream with no env overrides', () => {
    // Ensure no conflicting env vars
    delete process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    delete process.env.TERM;
    expect(supportsColor(createMockStream({ isTTY: true }))).toBe(true);
  });

  it('returns false for non-TTY stream with no env overrides', () => {
    delete process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    delete process.env.TERM;
    expect(supportsColor(createMockStream({ isTTY: false }))).toBe(false);
  });
});

describe('getColumns', () => {
  it('returns stream.columns when set', () => {
    expect(getColumns(createMockStream({ columns: 120 }))).toBe(120);
  });

  it('returns 80 as default when columns not set', () => {
    expect(getColumns(createMockStream())).toBe(80);
  });

  it('returns 80 when stream is undefined', () => {
    expect(getColumns(undefined)).toBe(80);
  });
});

describe('isEnabledByEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when AI_SPINNER_ENABLED=true', () => {
    vi.stubEnv('AI_SPINNER_ENABLED', 'true');
    expect(isEnabledByEnv()).toBe(true);
  });

  it('returns true when AI_SPINNER_ENABLED=1', () => {
    vi.stubEnv('AI_SPINNER_ENABLED', '1');
    expect(isEnabledByEnv()).toBe(true);
  });

  it('returns false when AI_SPINNER_ENABLED=false', () => {
    vi.stubEnv('AI_SPINNER_ENABLED', 'false');
    expect(isEnabledByEnv()).toBe(false);
  });

  it('returns false when AI_SPINNER_ENABLED=0', () => {
    vi.stubEnv('AI_SPINNER_ENABLED', '0');
    expect(isEnabledByEnv()).toBe(false);
  });

  it('returns undefined when AI_SPINNER_ENABLED is not set', () => {
    delete process.env.AI_SPINNER_ENABLED;
    expect(isEnabledByEnv()).toBeUndefined();
  });

  it('returns undefined when AI_SPINNER_ENABLED is empty string', () => {
    vi.stubEnv('AI_SPINNER_ENABLED', '');
    expect(isEnabledByEnv()).toBeUndefined();
  });
});
