import { isPlatformBrowser } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { clampOverflows, heroDescToggleIcon, heroDescToggleLabel } from './hero-description';

let nextId = 0;

/**
 * Item page hero description with the homepage hero's clamp and expander (HERO-DSC-001/003):
 * clamped to 5 lines wide, 4 at <=1280px and 3 at <=700px; when the text overflows, a round
 * chevron sits on the last visible line over a fade. Expanded, the clamp is off, the text shows
 * in full up to 60vh (the rest scrolls inside) and the chevron moves to its own band under it.
 *
 * `clamped` false renders plain text with no clamp and no expander (Azure hits, #702).
 * Contract: docs/item-hero-description.md.
 */
@Component({
  selector: 'app-hero-description',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './hero-description.component.html',
  styleUrl: './hero-description.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-clamped]': 'clamped()',
    '[class.is-expanded]': 'expanded()',
  },
})
export class HeroDescriptionComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly text = input('');
  /** Apply the clamp + expander. False: plain text, never a toggle. */
  readonly clamped = input(true);

  protected readonly descId = `hero-desc-${++nextId}`;
  private readonly descRef = viewChild<ElementRef<HTMLElement>>('desc');

  /** Back to collapsed whenever the text (another item) or the clamp mode changes. */
  readonly expanded = linkedSignal<{ text: string; clamped: boolean }, boolean>({
    source: () => ({ text: this.text(), clamped: this.clamped() }),
    computation: () => false,
  });
  /**
   * Emits the new state on a user toggle, before it renders, so the host can measure the
   * collapsed layout first (the item page keeps the hero's top in place, HERO-DSC-005).
   */
  readonly expandedChange = output<boolean>();
  protected readonly overflows = signal(false);
  /** Shown while overflowing, and always while expanded (it must stay to collapse again). */
  protected readonly showToggle = computed(() => this.clamped() && (this.overflows() || this.expanded()));
  protected readonly toggleLabel = computed(() => heroDescToggleLabel(this.expanded()));
  protected readonly toggleIcon = computed(() => heroDescToggleIcon(this.expanded()));

  constructor() {
    afterRenderEffect(() => {
      this.text();
      this.clamped();
      this.expanded();
      this.descRef();
      this.measure();
    });

    if (isPlatformBrowser(this.platformId)) {
      const destroyRef = inject(DestroyRef);
      let destroyed = false;
      // Wrapping changes with the column width and when web fonts swap in.
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.measure()) : undefined;
      afterRenderEffect(() => {
        const element = this.descRef()?.nativeElement;
        observer?.disconnect();
        if (element) {
          observer?.observe(element);
        }
      });
      document.fonts?.ready.then(() => {
        if (!destroyed) {
          this.measure();
        }
      });
      destroyRef.onDestroy(() => {
        destroyed = true;
        observer?.disconnect();
      });
    }
  }

  protected toggle(event?: Event): void {
    event?.stopPropagation();
    const expanding = !this.expanded();
    if (!expanding) {
      // Collapse from a scrolled position: the first line goes back to the top of the clamp.
      const element = this.descRef()?.nativeElement;
      if (element) {
        element.scrollTop = 0;
      }
    }
    this.expandedChange.emit(expanding);
    this.expanded.set(expanding);
  }

  /** Browser only: does the collapsed text overflow its clamp? Kept as-is while expanded. */
  protected measure(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.clamped()) {
      this.overflows.set(false);
      return;
    }
    if (this.expanded()) {
      return;
    }
    const element = this.descRef()?.nativeElement;
    this.overflows.set(!!element && clampOverflows(element));
  }
}