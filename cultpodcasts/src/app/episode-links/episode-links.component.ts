import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { environment } from './../../environments/environment';
import { formatDate } from '@angular/common';
import { GuidService } from '../guid.service';
import { MatButtonModule } from '@angular/material/button';
import { HomepageEpisode } from "../homepage-episode.interface";
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";
import { BBCServiceResolver } from "../service-resolver";
import { SearchResult } from "../search-result.interface";
import { appleUrl, spotifyUrl, toUrl, youtubeUrl } from "../search-result-links";

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

  get spotify(): URL | undefined {
    return this.episode ? spotifyUrl(this.episode) : undefined;
  }

  get applePodcasts(): URL | undefined {
    return this.episode ? appleUrl(this.episode) : undefined;
  }

  get youtube(): URL | undefined {
    return this.episode ? youtubeUrl(this.episode) : undefined;
  }

  get bbciPlayer(): URL | undefined {
    const bbc = toUrl(this.episode?.bbc);
    if (bbc && BBCServiceResolver.isIplayer(bbc)) {
      return bbc;
    }
    return undefined;
  }

  get bbcSounds(): URL | undefined {
    const bbc = toUrl(this.episode?.bbc);
    if (bbc && BBCServiceResolver.isSounds(bbc)) {
      return bbc;
    }
    return undefined;
  }

  get internetArchive(): URL | undefined {
    return toUrl(this.episode?.internetArchive);
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
