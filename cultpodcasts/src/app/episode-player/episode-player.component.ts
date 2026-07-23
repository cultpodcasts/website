import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApplePodcastsSvgComponent } from '../apple-podcasts-svg/apple-podcasts-svg.component';
import {
  EmbedService,
  EpisodeEmbedOption,
  episodeEmbedOptions,
  preferredEmbedService,
} from '../episode-embed';
import { HomepageEpisode } from '../homepage-episode.interface';
import { episodeImageUrl } from '../search-result-links';

@Component({
  selector: 'app-episode-player',
  imports: [RouterLink, MatButtonModule, MatIconModule, ApplePodcastsSvgComponent],
  templateUrl: './episode-player.component.html',
  styleUrl: './episode-player.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.episode-player--open]': '!!episode()',
    '[class.episode-player--video]': 'active()?.service === "youtube"',
    role: 'complementary',
    'aria-label': 'Episode player',
  },
})
export class EpisodePlayerComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly episode = input<HomepageEpisode | undefined>(undefined);
  readonly closed = output<void>();

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

  protected readonly safeEmbedUrl = computed((): SafeResourceUrl | undefined => {
    const url = this.active()?.embedUrl;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : undefined;
  });

  protected readonly artwork = computed(() => {
    const ep = this.episode();
    return ep ? episodeImageUrl(ep)?.toString() : undefined;
  });

  constructor() {
    effect(() => {
      const ep = this.episode();
      if (!ep) {
        this.service.set(undefined);
        return;
      }
      this.service.set(preferredEmbedService(episodeEmbedOptions(ep)));
    });
  }

  selectService(service: EmbedService, event?: Event): void {
    event?.stopPropagation();
    if (this.options().some((o) => o.service === service)) {
      this.service.set(service);
    }
  }

  close(): void {
    this.closed.emit();
  }
}
