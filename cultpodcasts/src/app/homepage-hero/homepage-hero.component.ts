import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HomepageEpisode } from '../homepage-episode.interface';
import { PlayerService } from '../player.service';
import { episodeImageUrl, SearchDisplayEpisode } from '../search-result-links';
import { languageFlagBadgeForEpisode, LanguageFlagBadge } from '../language-flag';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';
import { episodeEmbedOptions, playActionLabel } from '../episode-embed';
import { displayCatalogName } from '../display-catalog-name';

@Component({
  selector: 'app-homepage-hero',
  imports: [RouterLink, MatButtonModule, MatIconModule, SubjectChipComponent],
  templateUrl: './homepage-hero.component.html',
  styleUrl: './homepage-hero.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomepageHeroComponent {
  private static readonly heroIntervalMs = 7500;
  private static readonly heroImageFallbackMs = 2500;
  private static readonly heroTransitionMs = 1200;
  private static readonly heroContentOutMs = 320;

  readonly slides = input.required<HomepageEpisode[]>();
  readonly curatedEpisodeIds = input<readonly string[]>([]);
  readonly isCurator = input(false);

  readonly manageHero = output<void>();
  readonly manageRails = output<void>();
  readonly removeFeatured = output<string>();
  readonly play = output<SearchDisplayEpisode>();

  private readonly playerService = inject(PlayerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly heroIndex = signal(0);
  protected readonly heroPaused = signal(false);
  protected readonly heroContentVisible = signal(true);
  protected readonly heroImageReady = signal(false);
  protected readonly heroFrontLayer = signal<'a' | 'b'>('a');
  protected readonly heroLayerA = signal<string | undefined>(undefined);
  protected readonly heroLayerB = signal<string | undefined>(undefined);
  protected readonly heroKenBurnsA = signal(false);
  protected readonly heroKenBurnsB = signal(false);
  protected readonly heroDotsOverflowStart = signal(false);
  protected readonly heroDotsOverflowEnd = signal(false);
  private readonly heroDotsViewport = viewChild<ElementRef<HTMLElement>>('heroDotsViewport');

  protected readonly displayCatalogName = displayCatalogName;

  private readonly curatedIdSet = computed(() => new Set(this.curatedEpisodeIds()));

  protected readonly featured = computed(() => {
    const slides = this.slides();
    if (slides.length === 0) {
      return undefined;
    }
    return slides[this.heroIndex() % slides.length];
  });

  protected readonly featuredIsCurated = computed(() => {
    const ep = this.featured();
    return !!ep && this.curatedIdSet().has(ep.id);
  });

  private readonly featuredImage = computed(() => {
    const ep = this.featured();
    return ep ? episodeImageUrl(ep)?.toString() : undefined;
  });

  protected readonly featuredDesc = computed(() => {
    const text = this.featured()?.episodeDescription ?? '';
    return text.length > 220 ? `${text.slice(0, 220).trim()}…` : text;
  });

  protected readonly featuredSubjects = computed(() => {
    const subjects = this.featured()?.subjects ?? [];
    return subjects.filter((s) => !s.startsWith('_')).slice(0, 4);
  });

  private heroTimer: ReturnType<typeof setInterval> | undefined;
  private heroContentTimer: ReturnType<typeof setTimeout> | undefined;
  private heroImageFallbackTimer: ReturnType<typeof setTimeout> | undefined;
  private heroKenBurnsClearTimer: ReturnType<typeof setTimeout> | undefined;
  private heroImageToken = 0;
  private heroDotsOverflowTimer: ReturnType<typeof setTimeout> | undefined;
  private reduceMotion = false;
  private hasInitializedIndex = false;
  private lastFeaturedId: string | undefined;
  private lastSlideSignature: string | undefined;
  private resizeFrame = 0;
  private dotsScrollFrame = 0;
  private dotsScrollTarget: HTMLElement | undefined;

  /**
   * Window resize and dots-strip scroll are bound outside Angular's event manager: in a
   * zoneless app each listener invocation schedules a change-detection pass, and both fire
   * in bursts (mobile URL-bar collapse, smooth-scrolling the dots on every auto-advance).
   */
  private readonly onResizeEvent = (): void => {
    if (this.resizeFrame) {
      return;
    }
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.scrollActiveHeroDotIntoView(this.heroIndex(), 'auto');
    });
  };

  private readonly onDotsScrollEvent = (): void => {
    if (this.dotsScrollFrame) {
      return;
    }
    this.dotsScrollFrame = requestAnimationFrame(() => {
      this.dotsScrollFrame = 0;
      this.syncHeroDotsOverflow();
    });
  };

  constructor() {
    afterRenderEffect(() => {
      const index = this.heroIndex();
      const slideCount = this.slides().length;
      if (!isPlatformBrowser(this.platformId) || slideCount < 2) {
        return;
      }
      this.scrollActiveHeroDotIntoView(index);
    });

    afterRenderEffect(() => {
      const element = this.heroDotsViewport()?.nativeElement;
      if (element === this.dotsScrollTarget) {
        return;
      }
      this.dotsScrollTarget?.removeEventListener('scroll', this.onDotsScrollEvent);
      this.dotsScrollTarget = element;
      element?.addEventListener('scroll', this.onDotsScrollEvent, { passive: true });
    });

    // Full remount (loading shell) starts on the first curated/featured slide;
    // quiet slide refreshes keep the currently featured episode when possible.
    effect(() => {
      const slides = this.slides();
      const n = slides.length;
      if (n === 0) {
        this.hasInitializedIndex = false;
        this.lastFeaturedId = undefined;
        this.lastSlideSignature = undefined;
        this.heroIndex.set(0);
        this.stopHeroCycle();
        return;
      }

      // A background refresh or a promote toggle re-emits an equal slide array. Rebuilding
      // the image layers there would reload the backdrop and restart the dwell timer, so
      // only react when the sequence itself changed.
      const signature = slides.map((slide) => slide.id).join('|');
      if (this.hasInitializedIndex && signature === this.lastSlideSignature) {
        return;
      }
      this.lastSlideSignature = signature;

      if (!this.hasInitializedIndex) {
        this.heroIndex.set(0);
        this.hasInitializedIndex = true;
      } else {
        const keep = this.lastFeaturedId
          ? slides.findIndex((s) => s.id === this.lastFeaturedId)
          : -1;
        if (keep >= 0) {
          this.heroIndex.set(keep);
        } else {
          this.heroIndex.set(this.heroIndex() % n);
        }
      }

      this.lastFeaturedId = slides[this.heroIndex() % n]?.id;
      this.heroContentVisible.set(true);
      this.syncHeroLayers(true);
      this.startHeroCycle();
    });

    if (isPlatformBrowser(this.platformId)) {
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.addEventListener('resize', this.onResizeEvent, { passive: true });
      this.destroyRef.onDestroy(() => {
        this.stopHeroCycle();
        this.clearHeroImageWait();
        window.removeEventListener('resize', this.onResizeEvent);
        this.dotsScrollTarget?.removeEventListener('scroll', this.onDotsScrollEvent);
        this.dotsScrollTarget = undefined;
        if (this.resizeFrame) {
          cancelAnimationFrame(this.resizeFrame);
        }
        if (this.dotsScrollFrame) {
          cancelAnimationFrame(this.dotsScrollFrame);
        }
        if (this.heroDotsOverflowTimer) {
          clearTimeout(this.heroDotsOverflowTimer);
        }
        if (this.heroKenBurnsClearTimer) {
          clearTimeout(this.heroKenBurnsClearTimer);
        }
      });
    }
  }

  protected isPromoted(episodeId: string): boolean {
    return this.curatedIdSet().has(episodeId);
  }

  protected durationLabel(duration: string): string {
    return duration.startsWith('0') ? duration.substring(1) : duration;
  }

  protected canPlay(episode: HomepageEpisode | SearchDisplayEpisode): boolean {
    return episodeEmbedOptions(episode).length > 0;
  }

  protected playLabel(episode: HomepageEpisode | SearchDisplayEpisode): 'Watch' | 'Listen' {
    return playActionLabel(episode);
  }

  protected languageFlag(episode: HomepageEpisode): LanguageFlagBadge | undefined {
    return languageFlagBadgeForEpisode(episode);
  }

  playEpisode(episode: HomepageEpisode | SearchDisplayEpisode, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canPlay(episode)) {
      return;
    }
    this.heroPaused.set(true);
    this.play.emit(episode);
  }

  pauseHero(): void {
    this.heroPaused.set(true);
  }

  resumeHero(): void {
    if (this.playerService.episode()) {
      return;
    }
    this.heroPaused.set(false);
  }

  goHero(index: number): void {
    const slides = this.slides();
    if (slides.length === 0) {
      return;
    }
    this.transitionTo(index % slides.length);
    this.restartHeroCycle();
  }

  nextHero(): void {
    const n = this.slides().length;
    if (n === 0) {
      return;
    }
    this.transitionTo((this.heroIndex() + 1) % n);
    this.restartHeroCycle();
  }

  prevHero(): void {
    const n = this.slides().length;
    if (n === 0) {
      return;
    }
    this.transitionTo((this.heroIndex() - 1 + n) % n);
    this.restartHeroCycle();
  }

  private scrollActiveHeroDotIntoView(
    index: number,
    behavior: ScrollBehavior = this.reduceMotion ? 'auto' : 'smooth'
  ): void {
    const viewport = this.heroDotsViewport()?.nativeElement;
    if (!viewport) {
      return;
    }
    const active = viewport.querySelector<HTMLElement>(`[data-hero-dot="${index}"]`);
    if (!active) {
      this.syncHeroDotsOverflow();
      return;
    }

    const viewportWidth = viewport.clientWidth;
    const targetLeft = active.offsetLeft - (viewportWidth - active.offsetWidth) / 2;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewportWidth);
    const nextLeft = Math.max(0, Math.min(targetLeft, maxScroll));

    if (Math.abs(viewport.scrollLeft - nextLeft) > 1) {
      viewport.scrollTo({ left: nextLeft, behavior });
    }
    this.syncHeroDotsOverflow();
    if (behavior === 'smooth') {
      if (this.heroDotsOverflowTimer) {
        clearTimeout(this.heroDotsOverflowTimer);
      }
      this.heroDotsOverflowTimer = setTimeout(() => this.syncHeroDotsOverflow(), 320);
    }
  }

  private syncHeroDotsOverflow(): void {
    const viewport = this.heroDotsViewport()?.nativeElement;
    if (!viewport) {
      this.heroDotsOverflowStart.set(false);
      this.heroDotsOverflowEnd.set(false);
      return;
    }
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    if (maxScroll <= 1) {
      this.heroDotsOverflowStart.set(false);
      this.heroDotsOverflowEnd.set(false);
      return;
    }
    this.heroDotsOverflowStart.set(viewport.scrollLeft > 1);
    this.heroDotsOverflowEnd.set(viewport.scrollLeft < maxScroll - 1);
  }

  private transitionTo(index: number): void {
    if (index === this.heroIndex()) {
      return;
    }
    if (this.reduceMotion) {
      this.heroIndex.set(index);
      this.lastFeaturedId = this.slides()[index]?.id;
      this.syncHeroLayers(true);
      this.heroContentVisible.set(true);
      this.beginHeroImageGate();
      return;
    }

    this.heroContentVisible.set(false);
    if (this.heroContentTimer) {
      clearTimeout(this.heroContentTimer);
    }
    this.heroContentTimer = setTimeout(() => {
      this.heroIndex.set(index);
      this.lastFeaturedId = this.slides()[index]?.id;
      this.syncHeroLayers(false);
      this.beginHeroImageGate();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.heroContentVisible.set(true));
      });
    }, HomepageHeroComponent.heroContentOutMs);
  }

  private syncHeroLayers(immediate: boolean): void {
    const url = this.featuredImage();
    if (immediate || this.reduceMotion) {
      if (this.heroKenBurnsClearTimer) {
        clearTimeout(this.heroKenBurnsClearTimer);
        this.heroKenBurnsClearTimer = undefined;
      }
      this.heroLayerA.set(url);
      this.heroLayerB.set(undefined);
      this.heroFrontLayer.set('a');
      this.heroKenBurnsA.set(!!url && !this.reduceMotion);
      this.heroKenBurnsB.set(false);
      return;
    }
    const front = this.heroFrontLayer();
    if (front === 'a') {
      this.heroKenBurnsB.set(false);
      this.heroLayerB.set(url);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.heroFrontLayer.set('b');
          this.scheduleOutgoingKenBurnsClear('a');
        });
      });
    } else {
      this.heroKenBurnsA.set(false);
      this.heroLayerA.set(url);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.heroFrontLayer.set('a');
          this.scheduleOutgoingKenBurnsClear('b');
        });
      });
    }
  }

  private scheduleOutgoingKenBurnsClear(outgoing: 'a' | 'b'): void {
    if (this.heroKenBurnsClearTimer) {
      clearTimeout(this.heroKenBurnsClearTimer);
    }
    this.heroKenBurnsClearTimer = setTimeout(() => {
      this.heroKenBurnsClearTimer = undefined;
      if (this.heroFrontLayer() === outgoing) {
        return;
      }
      if (outgoing === 'a') {
        this.heroKenBurnsA.set(false);
        this.heroLayerA.set(undefined);
      } else {
        this.heroKenBurnsB.set(false);
        this.heroLayerB.set(undefined);
      }
    }, HomepageHeroComponent.heroTransitionMs);
  }

  private beginHeroImageGate(): void {
    this.clearHeroImageWait();
    this.heroImageReady.set(false);
    if (!isPlatformBrowser(this.platformId)) {
      this.heroImageReady.set(true);
      this.enableKenBurnsOnFront();
      return;
    }
    const url = this.featuredImage();
    const token = ++this.heroImageToken;
    if (!url) {
      this.heroImageReady.set(true);
      this.enableKenBurnsOnFront();
      return;
    }

    this.heroImageFallbackTimer = setTimeout(() => {
      if (token === this.heroImageToken) {
        this.heroImageReady.set(true);
        this.enableKenBurnsOnFront();
      }
    }, HomepageHeroComponent.heroImageFallbackMs);

    const img = new Image();
    // The billboard backdrop is the page's largest visual; a plain `new Image()`
    // (like the CSS background-image it warms the cache for) fetches at Low priority.
    img.fetchPriority = 'high';
    img.decoding = 'async';
    const markReady = () => {
      if (token !== this.heroImageToken) {
        return;
      }
      this.clearHeroImageWait();
      this.heroImageReady.set(true);
      this.enableKenBurnsOnFront();
    };
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(markReady, markReady);
      } else {
        markReady();
      }
    };
    img.onerror = markReady;
    img.src = url;
    if (img.complete) {
      markReady();
    }
  }

  private enableKenBurnsOnFront(): void {
    if (this.reduceMotion) {
      return;
    }
    if (this.heroFrontLayer() === 'a') {
      this.heroKenBurnsA.set(true);
    } else {
      this.heroKenBurnsB.set(true);
    }
  }

  private clearHeroImageWait(): void {
    if (this.heroImageFallbackTimer) {
      clearTimeout(this.heroImageFallbackTimer);
      this.heroImageFallbackTimer = undefined;
    }
  }

  private startHeroCycle(): void {
    this.stopHeroCycle();
    if (!isPlatformBrowser(this.platformId) || this.reduceMotion) {
      this.heroImageReady.set(true);
      return;
    }
    if (this.slides().length < 2) {
      this.beginHeroImageGate();
      return;
    }
    this.beginHeroImageGate();
    let elapsed = 0;
    const tickMs = 250;
    this.heroTimer = setInterval(() => {
      if (this.heroPaused() || !this.heroImageReady()) {
        return;
      }
      elapsed += tickMs;
      if (elapsed < HomepageHeroComponent.heroIntervalMs) {
        return;
      }
      elapsed = 0;
      const n = this.slides().length;
      if (n < 2) {
        return;
      }
      this.transitionTo((this.heroIndex() + 1) % n);
    }, tickMs);
  }

  private restartHeroCycle(): void {
    this.startHeroCycle();
  }

  private stopHeroCycle(): void {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = undefined;
    }
    if (this.heroContentTimer) {
      clearTimeout(this.heroContentTimer);
      this.heroContentTimer = undefined;
    }
  }
}
