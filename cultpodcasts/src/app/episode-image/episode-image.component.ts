import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { HomepageEpisode } from "../homepage-episode.interface";
import { ApiEpisode } from '../api-episode.interface';
import { DiscoveryResult } from '../discovery-result.interface';
import { MatIconModule } from '@angular/material/icon';
import { ApplePodcastsSvgComponent } from '../apple-podcasts-svg/apple-podcasts-svg.component';
import { SearchResult } from '../search-result.interface';
import { MatButtonModule } from '@angular/material/button';
import { appleUrl, bbcIplayerUrl, bbcSoundsUrl, episodeImageUrl, internetArchiveUrl, spotifyUrl, youtubeUrl } from '../search-result-links';
import { collectEpisodeServices } from '../service-catalog';

@Component({
  selector: 'app-episode-image',
  imports: [
    MatIconModule,
    MatButtonModule,
    ApplePodcastsSvgComponent
  ],
  templateUrl: './episode-image.component.html',
  styleUrl: './episode-image.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpisodeImageComponent {
  @Input()
  searchResult: HomepageEpisode | SearchResult | undefined;

  @Input()
  apiEpisode: ApiEpisode | undefined;

  @Input()
  discoveryResult: DiscoveryResult | undefined;

  @Input()
  linksOverlay: boolean = false;

  /** wide = 16:9 banner; tile = square thumb for list rows */
  @Input()
  layout: 'wide' | 'tile' = 'wide';

  protected readonly overlayVisible = signal(false);

  get imageUrl(): URL | undefined {
    let imageUrl: URL | undefined;
    if (this.searchResult) {
      imageUrl = episodeImageUrl(this.searchResult);
    } else if (this.apiEpisode) {
      imageUrl = this.apiEpisode.image;
    } else if (this.discoveryResult) {
      imageUrl = this.discoveryResult.imageUrl;
    }
    return imageUrl;
  }

  get isCropped(): boolean {
    let imageUrl: URL | undefined = this.imageUrl;
    if (imageUrl &&
      imageUrl.host.indexOf("i.ytimg.com") == 0 &&
      imageUrl.pathname.indexOf("maxresdefault") == -1) {
      return true;
    }
    return false;
  }

  /** YouTube thumbs are 16:9 — tile rows must not square-crop them. */
  get isWideArt(): boolean {
    const imageUrl = this.imageUrl;
    return !!imageUrl && imageUrl.host.indexOf("i.ytimg.com") == 0;
  }

  overlay($event: Event, show: boolean) {
    if (this.linksOverlay) {
      this.overlayVisible.set(show);
      $event.stopPropagation();
    }
  }

  get serviceLinks() {
    if (this.searchResult) {
      return collectEpisodeServices({
        youtube: youtubeUrl(this.searchResult),
        spotify: spotifyUrl(this.searchResult),
        apple: appleUrl(this.searchResult),
        bbc: bbcIplayerUrl(this.searchResult) ?? bbcSoundsUrl(this.searchResult),
        internetArchive: internetArchiveUrl(this.searchResult),
        svc: this.searchResult.svc,
        services: this.searchResult.services
      });
    }
    if (this.apiEpisode) {
      return collectEpisodeServices({
        youtube: this.asUrl(this.apiEpisode.urls.youtube),
        spotify: this.asUrl(this.apiEpisode.urls.spotify),
        apple: this.asUrl(this.apiEpisode.urls.apple),
        bbc: this.asUrl(this.apiEpisode.urls.bbc),
        internetArchive: this.asUrl(this.apiEpisode.urls.internetArchive),
        services: this.apiEpisode.services
      });
    }
    if (this.discoveryResult) {
      return collectEpisodeServices({
        youtube: this.discoveryResult.urls.youtube,
        spotify: this.discoveryResult.urls.spotify,
        apple: this.discoveryResult.urls.apple
      });
    }
    return [];
  }

  private asUrl(value: URL | string | undefined | null): URL | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof URL) {
      return value;
    }
    try {
      return new URL(value);
    } catch {
      return undefined;
    }
  }
}
