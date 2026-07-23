import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DEFAULT_SLOT_MACHINE_PRESET,
  SLOT_MACHINE_PRESETS,
  SlotMachineAnimationPreset,
  SlotMachinePreset,
} from './slot-machine-counter.animation';

export interface SlotColumn {
  type: 'digit' | 'comma';
  display: string;
  spinning: boolean;
  settleDigit: number;
}

@Component({
  selector: 'app-slot-machine-counter',
  templateUrl: './slot-machine-counter.component.html',
  styleUrl: './slot-machine-counter.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--slot-spin-duration]': 'spinDuration()',
    '[style.--slot-settle-duration]': 'settleDuration()',
    '[attr.title]': 'title() ?? null',
  },
})
export class SlotMachineCounterComponent {
  readonly baseline = input(0);
  readonly value = input<number | null | undefined>(undefined);
  readonly title = input<string | undefined>(undefined);
  readonly preset = input<SlotMachinePreset>(DEFAULT_SLOT_MACHINE_PRESET);

  protected readonly columns = signal<SlotColumn[]>([]);
  readonly reelDigits = Array.from({ length: 30 }, (_, index) => index % 10);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private settleTimers: ReturnType<typeof setTimeout>[] = [];
  private displayedValue: number | undefined;
  private readonly prefersReducedMotion: boolean;
  private readonly animationPreset = computed((): SlotMachineAnimationPreset =>
    SLOT_MACHINE_PRESETS[this.preset()] ?? SLOT_MACHINE_PRESETS[DEFAULT_SLOT_MACHINE_PRESET]
  );

  protected readonly spinDuration = computed(() => `${this.animationPreset().spinCycleMs}ms`);
  protected readonly settleDuration = computed(() => `${this.animationPreset().settleMs}ms`);

  constructor() {
    const browser = isPlatformBrowser(this.platformId);
    this.prefersReducedMotion =
      !browser ||
      (typeof window !== 'undefined' &&
        !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    // SSR: show baseline/value statically — Zone historically deadlocked on setTimeout.
    this.columns.set(this.buildColumns(this.baseline(), false));

    effect(() => {
      const next = this.value();
      const baseline = this.baseline();
      if (next == null || Number.isNaN(next)) {
        if (this.displayedValue !== undefined) {
          this.displayedValue = undefined;
        }
        this.clearTimers();
        this.columns.set(this.buildColumns(baseline, false));
        return;
      }
      if (this.displayedValue === next) {
        return;
      }
      this.animateTo(next);
    });

    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  reelTransform(column: SlotColumn): string {
    if (column.type !== 'digit' || column.spinning) {
      return 'translateY(0)';
    }
    return `translateY(-${column.settleDigit}em)`;
  }

  private animateTo(target: number): void {
    this.clearTimers();
    this.displayedValue = target;

    if (this.prefersReducedMotion || !isPlatformBrowser(this.platformId)) {
      this.columns.set(this.buildColumns(target, false));
      return;
    }

    this.columns.set(this.buildColumns(target, true));

    const digitColumnIndexes = this.columns()
      .map((column, index) => ({ column, index }))
      .filter((entry) => entry.column.type === 'digit')
      .map((entry) => entry.index);

    const [firstDigitIndex, ...spinningDigitIndexes] = digitColumnIndexes;
    if (firstDigitIndex !== undefined) {
      this.columns.update((cols) =>
        cols.map((column, index) =>
          index === firstDigitIndex && column.type === 'digit'
            ? { ...column, spinning: false }
            : column
        )
      );
    }

    const { baseDelayMs, staggerMs } = this.animationPreset();
    spinningDigitIndexes.forEach((columnIndex, order) => {
      const timer = setTimeout(() => {
        this.columns.update((cols) =>
          cols.map((column, index) =>
            index === columnIndex && column.type === 'digit'
              ? { ...column, spinning: false }
              : column
          )
        );
      }, baseDelayMs + order * staggerMs);
      this.settleTimers.push(timer);
    });
  }

  private buildColumns(value: number, spinning: boolean): SlotColumn[] {
    return this.formatValue(value)
      .split('')
      .map((char) => {
        if (char === ',') {
          return { type: 'comma', display: ',', spinning: false, settleDigit: 0 };
        }
        const digit = parseInt(char, 10);
        return {
          type: 'digit',
          display: char,
          spinning,
          settleDigit: digit,
        };
      });
  }

  private formatValue(value: number): string {
    return value.toLocaleString('en-US');
  }

  private clearTimers(): void {
    this.settleTimers.forEach((timer) => clearTimeout(timer));
    this.settleTimers = [];
  }
}
