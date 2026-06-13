export type SlotMachinePreset = 'snappy' | 'classic' | 'relaxed' | 'leisurely';

export interface SlotMachineAnimationPreset {
  label: string;
  spinCycleMs: number;
  settleMs: number;
  baseDelayMs: number;
  staggerMs: number;
}

export const SLOT_MACHINE_PRESETS: Record<SlotMachinePreset, SlotMachineAnimationPreset> = {
  snappy: {
    label: 'Snappy',
    spinCycleMs: 100,
    settleMs: 550,
    baseDelayMs: 700,
    staggerMs: 320
  },
  classic: {
    label: 'Classic',
    spinCycleMs: 150,
    settleMs: 650,
    baseDelayMs: 900,
    staggerMs: 250
  },
  relaxed: {
    label: 'Relaxed',
    spinCycleMs: 220,
    settleMs: 800,
    baseDelayMs: 1100,
    staggerMs: 500
  },
  leisurely: {
    label: 'Leisurely',
    spinCycleMs: 300,
    settleMs: 950,
    baseDelayMs: 1400,
    staggerMs: 600
  }
};

export const DEFAULT_SLOT_MACHINE_PRESET: SlotMachinePreset = 'relaxed';
