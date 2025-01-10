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

  get bbc(): URL | undefined {
    return this.episode?.bbc;
  }

  get internetArchive(): URL | undefined {
    return this.episode?.internetArchive;
  }

  constructor(private guidService: GuidService) { }

  share(item: HomepageEpisode) {
    let description = `"${item.episodeTitle}" - ${item.podcastName}`;
    description = description + ", " + formatDate(item.release, 'mediumDate', 'en-US');
    description = description + " [" + item.duration.split(".")[0].substring(1) + "]";
    const shortGuid = this.guidService.toBase64(item.id);
    const share = {
      title: item.episodeTitle,
      text: description,
      url: `${environment.shortner}/${shortGuid}`
    };
    window.navigator.share(share);
  }
}
