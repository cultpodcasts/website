import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApplePodcastsSvgComponent } from '../apple-podcasts-svg/apple-podcasts-svg.component';
import { EmbedService, EpisodeEmbedOption, episodeEmbedOptions } from '../episode-embed';
import { SearchDisplayEpisode, episodeImageUrl } from '../search-result-links';
import { PlayerService } from '../player.service';
import { languageFlagBadgeForEpisode } from '../language-flag';
import { displayCatalogName } from '../display-catalog-name';

interface YouTubePlayerLike {
  destroy(): void;
}

interface YouTubeStateChangeEvent {
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    elementId: string,
    options: { events?: { onStateChange?: (event: YouTubeStateChangeEvent) => void } }
  ) => YouTubePlayerLike;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YOUTUBE_IFRAME_ID = 'flix-player-frame';
const YOUTUBE_ENDED_STATE = 0;
const YOUTUBE_API_SCRIPT_ID = 'flix-youtube-iframe-api';
/** Published on the document root so other fixed UI (e.g. the "back to top" FAB) can clear the docked player. */
const DOCK_HEIGHT_CSS_VAR = '--flix-dock-height';

@Component({
  selector: 'app-episode-player',
  imports: [RouterLink, MatButtonModule, MatIconModule, ApplePodcastsSvgComponent],
  templateUrl: './episode-player.component.html',
  styleUrl: './episode-player.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.episode-player--open]': 'isOpen()',
    '[class.episode-player--theater]': "mode() === 'theater'",
    '[class.episode-player--dock]': "mode() === 'dock'",
    '[class.episode-player--video]': 'isVideo()',
    '[class.episode-player--has-queue]': 'queueCount() > 0',
    role: 'complementary',
    'aria-label': 'Episode player',
  },
})
export class EpisodePlayerComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly playerService = inject(PlayerService);

  protected readonly YOUTUBE_IFRAME_ID = YOUTUBE_IFRAME_ID;

  protected readonly episode = this.playerService.episode;
  protected readonly mode = this.playerService.mode;
  protected readonly queue = this.playerService.queue;
  protected readonly queueOpen = this.playerService.queueOpen;
  protected readonly isOpen = this.playerService.isOpen;

  /** Manual override of which service (YouTube/Spotify/Apple) to embed; resets per episode. */
  protected readonly service = signal<EmbedService | undefined>(undefined);

  protected readonly options = computed((): EpisodeEmbedOption[] => {
    const ep = this.episode();
    return ep ? episodeEmbedOptions(ep) : [];
  });

  protected readonly active = computed(() => {
    const opts = this.options();
    const selected = this.service();
    return opts.find((o) => o.service === selected) ?? opts[0];
  });

  protected readonly isVideo = computed(() => this.active()?.service === 'youtube');

  /** YouTube gets extra params so the IFrame Player API can detect when playback ends. */
  private readonly embedSrc = computed((): string | undefined => {
    const current = this.active();
    if (!current) {
      return undefined;
    }
    if (current.service !== 'youtube' || !isPlatformBrowser(this.platformId)) {
      return current.embedUrl;
    }
    const origin = encodeURIComponent(window.location.origin);
    return `${current.embedUrl}&enablejsapi=1&origin=${origin}`;
  });

  protected readonly safeEmbedUrl = computed((): SafeResourceUrl | undefined => {
    const url = this.embedSrc();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : undefined;
  });

  /** Force iframe remount when episode or service changes (browsers often ignore src-only updates). */
  protected readonly embedKey = computed((): string | undefined => {
    const ep = this.episode();
    const current = this.active();
    if (!ep || !current) {
      return undefined;
    }
    return `${ep.id}:${current.service}:${current.embedUrl}`;
  });

  protected readonly artwork = computed(() => {
    const ep = this.episode();
    return ep ? episodeImageUrl(ep)?.toString() : undefined;
  });

  protected readonly languageFlag = computed(() =>
    languageFlagBadgeForEpisode(this.episode() ?? {})
  );

  protected readonly displayCatalogName = displayCatalogName;

  protected readonly queueCount = computed(() => this.queue().length);

  /** Tracks whichever `.stage` element is currently rendered (playable or empty state). */
  private readonly stageEl = viewChild<ElementRef<HTMLElement>>('stageEl');

  private ytPlayer: YouTubePlayerLike | undefined;
  private ytApiPromise: Promise<void> | undefined;
  private dockResizeObserver: ResizeObserver | undefined;

  constructor() {
    effect(() => {
      const ep = this.episode();
      this.service.set(ep ? episodeEmbedOptions(ep)[0]?.service : undefined);
    });

    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const theaterOpen = this.isOpen() && this.mode() === 'theater';
        document.body.classList.toggle('flix-theater-lock', theaterOpen);
      });

      effect(() => {
        const key = this.embedKey();
        const video = this.isVideo();
        if (!key || !video) {
          this.teardownYouTubePlayer();
          return;
        }
        void this.attachYouTubeListener();
      });

      effect(() => {
        const isDocked = this.isOpen() && this.mode() === 'dock';
        this.observeDockHeight(isDocked ? this.stageEl()?.nativeElement : undefined);
      });

      this.destroyRef.onDestroy(() => {
        this.teardownYouTubePlayer();
        this.observeDockHeight(undefined);
        document.body.classList.remove('flix-theater-lock');
      });
    }
  }

  selectService(service: EmbedService, event?: Event): void {
    event?.stopPropagation();
    if (this.options().some((o) => o.service === service)) {
      this.service.set(service);
    }
  }

  close(): void {
    this.playerService.close();
  }

  expand(): void {
    this.playerService.expand();
  }

  minimize(): void {
    this.playerService.minimize();
  }

  toggleQueuePanel(): void {
    this.playerService.toggleQueuePanel();
  }

  playFromQueue(episode: SearchDisplayEpisode, event?: Event): void {
    event?.stopPropagation();
    this.playerService.playFromQueue(episode);
  }

  removeFromQueue(episode: SearchDisplayEpisode, event?: Event): void {
    event?.stopPropagation();
    this.playerService.removeFromQueue(episode);
  }

  episodeImage(episode: SearchDisplayEpisode): string | undefined {
    return episodeImageUrl(episode)?.toString();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.queueOpen()) {
      this.playerService.closeQueuePanel();
      return;
    }
    if (this.isOpen()) {
      this.close();
    }
  }

  private async attachYouTubeListener(): Promise<void> {
    await this.ensureYouTubeApi();
    // Give the updated iframe `src` binding a tick to land in the DOM before binding.
    setTimeout(() => {
      if (!this.isVideo() || !window.YT) {
        return;
      }
      this.teardownYouTubePlayer();
      try {
        this.ytPlayer = new window.YT.Player(YOUTUBE_IFRAME_ID, {
          events: {
            onStateChange: (event) => {
              if (event.data === YOUTUBE_ENDED_STATE) {
                this.playerService.playNext();
              }
            },
          },
        });
      } catch {
        this.ytPlayer = undefined;
      }
    }, 300);
  }

  private ensureYouTubeApi(): Promise<void> {
    if (window.YT?.Player) {
      return Promise.resolve();
    }
    if (this.ytApiPromise) {
      return this.ytApiPromise;
    }
    this.ytApiPromise = new Promise<void>((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      if (!document.getElementById(YOUTUBE_API_SCRIPT_ID)) {
        const script = document.createElement('script');
        script.id = YOUTUBE_API_SCRIPT_ID;
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    });
    return this.ytApiPromise;
  }

  private observeDockHeight(el: HTMLElement | undefined): void {
    this.dockResizeObserver?.disconnect();
    this.dockResizeObserver = undefined;
    if (!el) {
      document.documentElement.style.setProperty(DOCK_HEIGHT_CSS_VAR, '0px');
      return;
    }
    this.dockResizeObserver = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? el.offsetHeight;
      document.documentElement.style.setProperty(DOCK_HEIGHT_CSS_VAR, `${Math.ceil(height)}px`);
    });
    this.dockResizeObserver.observe(el);
  }

  private teardownYouTubePlayer(): void {
    try {
      this.ytPlayer?.destroy();
    } catch {
      // Ignore teardown races when the iframe has already navigated away.
    }
    this.ytPlayer = undefined;
  }
}
