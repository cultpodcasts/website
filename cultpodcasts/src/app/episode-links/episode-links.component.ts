import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { environment } from './../../environments/environment';
import { formatDate } from '@angular/common';
import { catalogueShareUrl } from '../catalogue-links';
import { MatButtonModule } from '@angular/material/button';
import { HomepageEpisode } from "../homepage-episode.interface";
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";
import { SearchResult } from "../search-result.interface";
import { appleUrl, bbcIplayerUrl, bbcSoundsUrl, internetArchiveUrl, spotifyUrl, youtubeUrl } from "../search-result-links";
import { collectEpisodeServices } from "../service-catalog";
import { identityLinkKind, identityServiceLinks, type IdentityLinkKind } from "../identity-service-links";

@Component({
  selector: 'app-episode-links',
  imports: [
    MatIconModule,
    MatButtonModule,
    ApplePodcastsSvgComponent
  ],
  templateUrl: './episode-links.component.html',
  styleUrl: './episode-links.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpisodeLinksComponent {
  @Input()
  episode: HomepageEpisode | SearchResult | undefined;

  /** Episode page: trailing share button. The homepage hero shows the service links only. */
  @Input()
  showShare = true;

  /**
   * `auto` derives film / TV-episode from contentKind. Pass `tv-show` on a TV-show hub (series ids).
   * `none` leaves the row as streaming services only.
   */
  @Input()
  identityKind: IdentityLinkKind | 'auto' | 'none' = 'auto';

  /** When false, only identity-service buttons are shown (TV-show hub: no episode streaming URLs). */
  @Input()
  includeStreaming = true;

  get serviceLinks() {
    if (!this.episode) {
      return [];
    }
    const streaming = this.includeStreaming
      ? collectEpisodeServices({
          youtube: youtubeUrl(this.episode),
          spotify: spotifyUrl(this.episode),
          apple: appleUrl(this.episode),
          bbc: bbcIplayerUrl(this.episode) ?? bbcSoundsUrl(this.episode),
          internetArchive: internetArchiveUrl(this.episode),
          svc: this.episode.svc,
          services: this.episode.services
        })
      : [];
    const kind = this.resolvedIdentityKind();
    const identity = kind ? identityServiceLinks(this.episode, kind) : [];
    return [...streaming, ...identity];
  }

  private resolvedIdentityKind(): IdentityLinkKind | null {
    if (this.identityKind === 'none') {
      return null;
    }
    if (this.identityKind === 'auto') {
      return identityLinkKind('contentKind' in this.episode! ? this.episode.contentKind : undefined);
    }
    return this.identityKind;
  }

  share(item: HomepageEpisode | SearchResult) {
    const url = catalogueShareUrl(item, window.location.origin, environment.shortner);
    if (!url) {
      return;
    }
    let description = `"${item.episodeTitle}" - ${item.podcastName}`;
    description = description + ", " + formatDate(item.release, 'mediumDate', 'en-US');

    let duration: string = item.duration.split(".")[0];
    if (duration.startsWith("0")) {
      duration = duration.substring(1);
    }
    description = description + " [" + duration + "]";
    const share: ShareData = {
      title: item.episodeTitle,
      text: description,
      url
    };
    window.navigator.share(share);
  }
}
