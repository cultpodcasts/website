import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { environment } from './../../environments/environment';
import { formatDate } from '@angular/common';
import { GuidService } from '../guid.service';
import { MatButtonModule } from '@angular/material/button';
import { HomepageEpisode } from "../homepage-episode.interface";
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";

@Component({
  selector: 'app-episode-links',
  imports: [
    MatIconModule,
    MatButtonModule,
    ApplePodcastsSvgComponent
  ],
  templateUrl: './episode-links.component.html',
  styleUrl: './episode-links.component.sass'
})
export class EpisodeLinksComponent {
  @Input()
  episode: HomepageEpisode | undefined;

  get spotify(): URL | undefined {
    return this.episode?.spotify;
  }

  get applePodcasts(): URL | undefined {
    return this.episode?.apple;
  }

  get youtube(): URL | undefined {
    return this.episode?.youtube;
  }

  get bbciPlayer(): URL | undefined {
    if (this.episode?.bbc &&
      (this.episode.bbc.pathname.startsWith("/iplayer/") ||
        this.episode.bbc.pathname.startsWith("/news/av-embeds/"))) {
      return this.episode?.bbc;
    }
    return undefined;
  }

  get bbcSounds(): URL | undefined {
    if (this.episode?.bbc && this.episode.bbc.pathname.startsWith("/sounds/")) {
      return this.episode?.bbc;
    }
    return undefined;
  }

  get internetArchive(): URL | undefined {
    return this.episode?.internetArchive;
  }

  constructor(private guidService: GuidService) { }

  share(item: HomepageEpisode) {
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
