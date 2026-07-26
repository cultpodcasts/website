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
  /**
   * Safety net only: the dwell timer is meant to start once the backdrop has painted.
   * Keep this long enough that a slow (but working) image still gates the countdown,
   * so a slide is never swapped out before it has ever been seen.
   */
  private static readonly heroImageFallbackMs = 12000;
  private static readonly heroTransitionMs = 1200;
  /** Hold the current title before text and image leave together. */
  private static readonly heroContentHoldMs = 450;
  /** Keep in sync with `.billboard__feature.is-hidden` transition-duration. */
  private static readonly heroContentOutMs = 550;

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
  /** Pointer is over the billboard (hover pause). */
  private pointerInside = false;
  /** Focus is inside the billboard (keyboard pause). */
  private focusInside = false;
  /**
   * Mid-transition latch: content stays faded out until the outgoing fade finishes
   * AND the incoming backdrop has decoded (or hit the safety fallback).
   */
  private heroTransitionToken = 0;

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
        this.heroTransitionToken++;
        this.heroImageToken++;
        this.stopHeroCycle();
        this.clearHeroContentTransition();
        this.clearHeroImageWait();
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
        this.clearHeroContentTransition();
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

  onHeroPointerEnter(): void {
    this.pointerInside = true;
    this.syncHeroPaused();
  }

  onHeroPointerLeave(): void {
    this.pointerInside = false;
    this.syncHeroPaused();
  }

  onHeroFocusIn(): void {
    this.focusInside = true;
    this.syncHeroPaused();
  }

  onHeroFocusOut(event: FocusEvent): void {
    const root = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    // focusout bubbles for every child blur; only clear when focus leaves the billboard.
    if (root && next && root.contains(next)) {
      return;
    }
    this.focusInside = false;
    this.syncHeroPaused();
  }

  goHero(index: number, event?: Event): void {
    const slides = this.slides();
    if (slides.length === 0) {
      return;
    }
    this.transitionTo(index % slides.length);
    this.restartHeroCycle();
    this.releasePagerFocus(event);
  }

  nextHero(event?: Event): void {
    const n = this.slides().length;
    if (n === 0) {
      return;
    }
    this.transitionTo((this.heroIndex() + 1) % n);
    this.restartHeroCycle();
    this.releasePagerFocus(event);
  }

  prevHero(event?: Event): void {
    const n = this.slides().length;
    if (n === 0) {
      return;
    }
    this.transitionTo((this.heroIndex() - 1 + n) % n);
    this.restartHeroCycle();
    this.releasePagerFocus(event);
  }

  /**
   * Mouse clicks leave focus on the chevron/dash, which kept the hero paused forever
   * via focusin. Blur and clear focus-pause so the dwell timer / dash fill can run
   * again once the pointer leaves (hover pause still applies while the pointer is inside).
   */
  private releasePagerFocus(event?: Event): void {
    const target = event?.currentTarget;
    if (target instanceof HTMLElement) {
      target.blur();
    }
    this.focusInside = false;
    this.syncHeroPaused();
  }

  private syncHeroPaused(): void {
    if (this.playerService.episode()) {
      this.heroPaused.set(true);
      return;
    }
    this.heroPaused.set(this.pointerInside || this.focusInside);
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

    // Hold the current slide while the next backdrop preloads. Once both the
    // hold and the image are ready, fade the copy out and crossfade the image
    // together — text leaving ahead of the backdrop is what spoils the effect.
    this.heroImageReady.set(false);
    this.clearHeroContentTransition();
    this.clearHeroImageWait();

    const slides = this.slides();
    const nextSlide = slides[index];
    const nextUrl = nextSlide ? episodeImageUrl(nextSlide)?.toString() : undefined;
    const transitionToken = ++this.heroTransitionToken;
    const imageToken = ++this.heroImageToken;

    let holdDone = false;
    let imageReady = !nextUrl;
    let crossfadeStarted = false;

    const beginCrossfade = (): void => {
      if (transitionToken !== this.heroTransitionToken || imageToken !== this.heroImageToken) {
        return;
      }
      if (!holdDone || !imageReady || crossfadeStarted) {
        return;
      }
      crossfadeStarted = true;

      // Image + text leave on the same beat.
      this.syncHeroLayers(false, nextUrl);
      this.heroContentVisible.set(false);
      this.clearHeroImageWait();
      this.heroImageReady.set(true);

      this.heroContentTimer = setTimeout(() => {
        if (transitionToken !== this.heroTransitionToken) {
          return;
        }
        // Swap copy while hidden, then fade in alongside the incoming backdrop.
        this.heroIndex.set(index);
        this.lastFeaturedId = nextSlide?.id;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (transitionToken !== this.heroTransitionToken) {
              return;
            }
            this.heroContentVisible.set(true);
          });
        });
      }, HomepageHeroComponent.heroContentOutMs);
    };

    this.heroContentTimer = setTimeout(() => {
      holdDone = true;
      beginCrossfade();
    }, HomepageHeroComponent.heroContentHoldMs);

    if (!nextUrl) {
      return;
    }

    this.heroImageFallbackTimer = setTimeout(() => {
      if (imageToken !== this.heroImageToken) {
        return;
      }
      imageReady = true;
      beginCrossfade();
    }, HomepageHeroComponent.heroImageFallbackMs);

    this.preloadHeroImage(nextUrl, imageToken, () => {
      imageReady = true;
      this.clearHeroImageWait();
      beginCrossfade();
    });
  }

  private syncHeroLayers(immediate: boolean, urlOverride?: string): void {
    const url = urlOverride ?? this.featuredImage();
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
          this.heroKenBurnsB.set(!!url && !this.reduceMotion);
          this.scheduleOutgoingKenBurnsClear('a');
        });
      });
    } else {
      this.heroKenBurnsA.set(false);
      this.heroLayerA.set(url);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.heroFrontLayer.set('a');
          this.heroKenBurnsA.set(!!url && !this.reduceMotion);
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

    this.preloadHeroImage(url, token, () => {
      this.clearHeroImageWait();
      this.heroImageReady.set(true);
      this.enableKenBurnsOnFront();
    });
  }

  /**
   * Warm + decode the next backdrop. Used both for the initial image gate and
   * for slide transitions so copy never advances ahead of a painted image.
   */
  private preloadHeroImage(url: string, token: number, onReady: () => void): void {
    const img = new Image();
    // The billboard backdrop is the page's largest visual; a plain `new Image()`
    // (like the CSS background-image it warms the cache for) fetches at Low priority.
    img.fetchPriority = 'high';
    img.decoding = 'async';
    const markReady = () => {
      if (token !== this.heroImageToken) {
        return;
      }
      onReady();
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
    this.scheduleHeroAdvance();
  }

  /**
   * Reset the dwell clock after a manual prev/next/dash jump.
   * Must not cancel `heroContentTimer` or the in-flight image preload —
   * `transitionTo` owns both, and clearing them here made the chevrons appear dead.
   */
  private restartHeroCycle(): void {
    this.stopHeroCycle();
    if (!isPlatformBrowser(this.platformId) || this.reduceMotion || this.slides().length < 2) {
      return;
    }
    this.scheduleHeroAdvance();
  }

  private scheduleHeroAdvance(): void {
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

  private stopHeroCycle(): void {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
      this.heroTimer = undefined;
    }
  }

  private clearHeroContentTransition(): void {
    if (this.heroContentTimer) {
      clearTimeout(this.heroContentTimer);
      this.heroContentTimer = undefined;
    }
  }
}
