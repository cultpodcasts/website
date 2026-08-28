import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { environment } from './../../environments/environment';
import { formatDate } from '@angular/common';
import { GuidService } from '../guid.service';
import { MatButtonModule } from '@angular/material/button';
import { HomepageEpisode } from "../homepage-episode.interface";
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";
import { SearchResult } from "../search-result.interface";
import { appleUrl, bbcIplayerUrl, bbcSoundsUrl, internetArchiveUrl, spotifyUrl, youtubeUrl } from "../search-result-links";
import { collectEpisodeServices } from "../service-catalog";

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

  get serviceLinks() {
    if (!this.episode) {
      return [];
    }
    return collectEpisodeServices({
      youtube: youtubeUrl(this.episode),
      spotify: spotifyUrl(this.episode),
      apple: appleUrl(this.episode),
      bbc: bbcIplayerUrl(this.episode) ?? bbcSoundsUrl(this.episode),
      internetArchive: internetArchiveUrl(this.episode),
      svc: this.episode.svc,
      services: this.episode.services
    });
  }

  constructor(private guidService: GuidService) { }

  share(item: HomepageEpisode | SearchResult) {
    let description = `"${item.episodeTitle}" - ${item.podcastName}`;
    description = description + ", " + formatDate(item.release, 'mediumDate', 'en-US');

    let duration: string = item.duration.split(".")[0];
    if (duration.startsWith("0")) {
      duration = duration.substring(1);
    }
    description = description + " [" + duration + "]";
    const shortGuid = this.guidService.toBase64(item.id);
    const share: ShareData = {
      title: item.episodeTitle,
      text: description,
      url: `${environment.shortner}/${shortGuid}`
    };
    window.navigator.share(share);
  }
}
