// ai-spinner - AI-aware terminal progress indicators with token and cost display

// Factory functions
export { createSpinner } from './spinner';
export { createPipeline } from './pipeline';

// Types
export type {
  AISpinner,
  AIPipeline,
  SpinnerOptions,
  SpinnerState,
  SpinnerMetrics,
  SpinnerPreset,
  ModelPricing,
  StreamingOptions,
  ToolCallOptions,
  RateLimitOptions,
  WrapStreamOptions,
  PipelineStepConfig,
  PipelineOptions,
  PipelineUpdateData,
  PipelineStep,
  PipelineStepStatus,
  FormatOptions,
  SymbolOptions,
} from './types';

// Presets
export { presets, getPreset, isPresetName } from './presets';
export type { PresetData } from './presets';

// Formatting utilities
export {
  formatTokens,
  formatTPS,
  formatCost,
  formatElapsed,
  formatCountdown,
} from './format';

// Pricing utilities
export {
  getModelPricing,
  calculateCost,
  BUILT_IN_PRICING,
} from './pricing';

// Terminal utilities
export {
  isTTY,
  isCI,
  supportsColor,
  getColumns,
  isEnabledByEnv,
} from './terminal';
