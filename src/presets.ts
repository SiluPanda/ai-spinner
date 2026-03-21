import type { SpinnerPreset } from './types';

export interface PresetData {
  frames: string[];
  interval: number;
}

const presets: Record<SpinnerPreset, PresetData> = {
  dots: {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    interval: 80,
  },
  line: {
    frames: ['-', '\\', '|', '/'],
    interval: 130,
  },
  arc: {
    frames: ['◜', '◠', '◝', '◞', '◡', '◟'],
    interval: 100,
  },
  arrow: {
    frames: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
    interval: 120,
  },
  bounce: {
    frames: ['⠁', '⠂', '⠄', '⠂'],
    interval: 120,
  },
};

/**
 * Get the preset data for a named spinner preset.
 */
export function getPreset(name: SpinnerPreset): PresetData {
  return presets[name];
}

/**
 * Check whether a value is a valid preset name.
 */
export function isPresetName(value: unknown): value is SpinnerPreset {
  return typeof value === 'string' && value in presets;
}

export { presets };
