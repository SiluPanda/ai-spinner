/**
 * Check whether a writable stream is a TTY.
 */
export function isTTY(stream?: NodeJS.WritableStream): boolean {
  if (!stream) return false;
  return (stream as NodeJS.WriteStream).isTTY === true;
}

/**
 * Check whether running in a CI environment.
 */
export function isCI(): boolean {
  const ci = process.env.CI;
  return ci !== undefined && ci !== '' && ci !== '0' && ci !== 'false';
}

/**
 * Check whether the stream supports ANSI colors.
 *
 * Priority: explicit option > FORCE_COLOR > NO_COLOR > stream.isTTY > false.
 */
export function supportsColor(
  stream?: NodeJS.WritableStream,
  colorOption?: boolean,
): boolean {
  if (colorOption !== undefined) return colorOption;

  const forceColor = process.env.FORCE_COLOR;
  if (forceColor !== undefined) {
    return forceColor !== '0';
  }

  if (process.env.NO_COLOR !== undefined) return false;

  if (process.env.TERM === 'dumb') return false;

  return isTTY(stream);
}

/**
 * Get the terminal width (columns).
 */
export function getColumns(stream?: NodeJS.WritableStream): number {
  if (stream && 'columns' in stream) {
    const cols = (stream as NodeJS.WriteStream).columns;
    if (typeof cols === 'number' && cols > 0) return cols;
  }
  return 80;
}

/**
 * Check the AI_SPINNER_ENABLED environment variable.
 * Returns true, false, or undefined (not set).
 */
export function isEnabledByEnv(): boolean | undefined {
  const val = process.env.AI_SPINNER_ENABLED;
  if (val === undefined || val === '') return undefined;
  if (val === '0' || val === 'false') return false;
  if (val === '1' || val === 'true') return true;
  return undefined;
}
