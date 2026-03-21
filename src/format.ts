/**
 * Format a token count for display.
 * Values >= 1000 get comma separators.
 */
export function formatTokens(n: number): string {
  if (n >= 1000) {
    return `${n.toLocaleString('en-US')} tokens`;
  }
  return `${n} tokens`;
}

/**
 * Format tokens per second with one decimal place.
 */
export function formatTPS(rate: number): string {
  return `${rate.toFixed(1)} tok/s`;
}

/**
 * Format cost in dollars.
 * < $0.01: 3 decimal places
 * >= $0.01: 2 decimal places
 */
export function formatCost(dollars: number): string {
  if (dollars < 0.01) {
    return `$${dollars.toFixed(3)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

/**
 * Format elapsed time from milliseconds.
 * < 60s: seconds with one decimal (e.g., "2.1s")
 * >= 60s: minutes and integer seconds (e.g., "1m 23s")
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format countdown seconds as integer seconds.
 */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds)}s`;
}
