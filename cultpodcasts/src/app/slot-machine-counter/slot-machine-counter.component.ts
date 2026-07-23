import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  signal
} from '@angular/core';
import {
  DEFAULT_SLOT_MACHINE_PRESET,
  SLOT_MACHINE_PRESETS,
  SlotMachineAnimationPreset,
  SlotMachinePreset
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlotMachineCounterComponent implements OnInit, OnChanges, OnDestroy {
  @Input() baseline: number = 0;
  @Input() value: number | null | undefined;
  @Input() title: string | undefined;
  @Input() preset: SlotMachinePreset = DEFAULT_SLOT_MACHINE_PRESET;

  protected readonly columns = signal<SlotColumn[]>([]);
  reelDigits = Array.from({ length: 30 }, (_, index) => index % 10);
  private settleTimers: ReturnType<typeof setTimeout>[] = [];
  private displayedValue: number | undefined;
  private prefersReducedMotion = false;
  private animationPreset: SlotMachineAnimationPreset = SLOT_MACHINE_PRESETS[DEFAULT_SLOT_MACHINE_PRESET];

  @HostBinding('style.--slot-spin-duration')
  get spinDuration(): string {
    return `${this.animationPreset.spinCycleMs}ms`;
  }

  @HostBinding('style.--slot-settle-duration')
  get settleDuration(): string {
    return `${this.animationPreset.settleMs}ms`;
  }

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  ngOnInit() {
    this.applyPreset();
    this.setColumns(this.baseline, false);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['preset']) {
      this.applyPreset();
    }

    if (this.value == null) {
      if (changes['baseline']) {
        this.displayedValue = undefined;
        this.setColumns(this.baseline, false);
      }
      return;
    }

    const nextValue = this.value;
    if (this.displayedValue === nextValue) {
      return;
    }
    this.animateTo(nextValue);
  }

  ngOnDestroy() {
    this.clearTimers();
  }

  reelTransform(column: SlotColumn): string {
    if (column.type !== 'digit' || column.spinning) {
      return 'translateY(0)';
    }
    return `translateY(-${column.settleDigit}em)`;
  }

  private animateTo(target: number) {
    this.clearTimers();
    this.displayedValue = target;

    if (this.prefersReducedMotion) {
      this.setColumns(target, false);
      return;
    }

    this.setColumns(target, true);

    const digitColumnIndexes = this.columns()
      .map((column, index) => ({ column, index }))
      .filter(entry => entry.column.type === 'digit')
      .map(entry => entry.index);

    const [firstDigitIndex, ...spinningDigitIndexes] = digitColumnIndexes;
    if (firstDigitIndex !== undefined) {
      this.columns.update(cols => cols.map((column, index) =>
        index === firstDigitIndex && column.type === 'digit'
          ? { ...column, spinning: false }
          : column
      ));
    }

    const { baseDelayMs, staggerMs } = this.animationPreset;

    spinningDigitIndexes.forEach((columnIndex, order) => {
      const timer = setTimeout(() => {
        this.columns.update(cols => cols.map((column, index) =>
          index === columnIndex && column.type === 'digit'
            ? { ...column, spinning: false }
            : column
        ));
      }, baseDelayMs + order * staggerMs);
      this.settleTimers.push(timer);
    });
  }

  private applyPreset() {
    this.animationPreset = SLOT_MACHINE_PRESETS[this.preset] ?? SLOT_MACHINE_PRESETS[DEFAULT_SLOT_MACHINE_PRESET];
  }

  private setColumns(value: number, spinning: boolean) {
    this.columns.set(this.formatValue(value).split('').map(char => {
      if (char === ',') {
        return { type: 'comma', display: ',', spinning: false, settleDigit: 0 };
      }
      const digit = parseInt(char, 10);
      return {
        type: 'digit',
        display: char,
        spinning,
        settleDigit: digit
      };
    }));
  }

  private formatValue(value: number): string {
    return value.toLocaleString('en-US');
  }

  private clearTimers() {
    this.settleTimers.forEach(timer => clearTimeout(timer));
    this.settleTimers = [];
  }
}
