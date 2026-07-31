import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { SlotMachineCounterComponent } from '../slot-machine-counter/slot-machine-counter.component';

type CatalogueSlide =
  | { kind: 'hero'; value: number; daysTitle?: string }
  | { kind: 'week'; value: number }
  | { kind: 'days'; value: string };

@Component({
  selector: 'app-homepage-catalogue',
  imports: [DecimalPipe, SlotMachineCounterComponent],
  templateUrl: './homepage-catalogue.component.html',
  styleUrl: './homepage-catalogue.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomepageCatalogueComponent {
  private static readonly NARROW_MQ = '(max-width: 700px)';
  private static readonly ROTATE_MS = 4200;

  readonly weekEpisodeCount = input<number | undefined>();
  readonly episodeCount = input<number | undefined>();
  readonly totalDurationDays = input<string>('');
  readonly episodeCountBaseline = input(80000);

  protected readonly activeIndex = signal(0);
  protected readonly carouselMode = signal(false);
  protected readonly reduceMotion = signal(false);

  /** Desktop grid order: week | index | days. Carousel starts on the index slide. */
  protected readonly slides = computed((): CatalogueSlide[] => {
    const slides: CatalogueSlide[] = [];
    const week = this.weekEpisodeCount();
    if (week != null) {
      slides.push({ kind: 'week', value: week });
    }
    const count = this.episodeCount();
    if (count != null) {
      const days = this.totalDurationDays();
      slides.push({
        kind: 'hero',
        value: count,
        daysTitle: days ? `${days} days` : undefined,
      });
    }
    const days = this.totalDurationDays();
    if (days) {
      slides.push({ kind: 'days', value: days });
    }
    return slides;
  });

  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private narrowQuery: MediaQueryList | undefined;
  private motionQuery: MediaQueryList | undefined;
  private rotateTimer: ReturnType<typeof setInterval> | undefined;
  private paused = false;

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    this.narrowQuery = window.matchMedia(HomepageCatalogueComponent.NARROW_MQ);
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.carouselMode.set(this.narrowQuery.matches);
    this.reduceMotion.set(this.motionQuery.matches);
    this.activeIndex.set(this.leadSlideIndex());
    this.narrowQuery.addEventListener('change', this.onNarrowChange);
    this.motionQuery.addEventListener('change', this.onMotionChange);
    this.syncRotation();
    this.destroyRef.onDestroy(() => {
      this.stopRotation();
      this.narrowQuery?.removeEventListener('change', this.onNarrowChange);
      this.motionQuery?.removeEventListener('change', this.onMotionChange);
    });
  }

  protected onCarouselPause(): void {
    this.paused = true;
    this.stopRotation();
  }

  protected onCarouselResume(event?: FocusEvent): void {
    if (event) {
      const next = event.relatedTarget as Node | null;
      const host = event.currentTarget as Node | null;
      if (next && host?.contains(next)) {
        return;
      }
    }
    this.paused = false;
    this.syncRotation();
  }

  protected selectSlide(index: number): void {
    const n = this.slides().length;
    if (n === 0) {
      return;
    }
    this.activeIndex.set(((index % n) + n) % n);
    this.syncRotation();
  }

  private leadSlideIndex(): number {
    const hero = this.slides().findIndex((s) => s.kind === 'hero');
    return hero >= 0 ? hero : 0;
  }

  private readonly onNarrowChange = () => {
    this.carouselMode.set(!!this.narrowQuery?.matches);
    this.activeIndex.set(this.leadSlideIndex());
    this.syncRotation();
  };

  private readonly onMotionChange = () => {
    this.reduceMotion.set(!!this.motionQuery?.matches);
    this.syncRotation();
  };

  private syncRotation(): void {
    this.stopRotation();
    if (!this.carouselMode() || this.reduceMotion() || this.paused || this.slides().length < 2) {
      return;
    }
    this.rotateTimer = setInterval(() => {
      const n = this.slides().length;
      if (n < 2) {
        return;
      }
      this.activeIndex.update((i) => (i + 1) % n);
    }, HomepageCatalogueComponent.ROTATE_MS);
  }

  private stopRotation(): void {
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = undefined;
    }
  }
}
