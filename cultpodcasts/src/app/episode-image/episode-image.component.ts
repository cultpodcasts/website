import { Component, Input } from '@angular/core';
import { HomepageEpisode } from "../homepage-episode.interface";
import { ApiEpisode } from '../api-episode.interface';
import { DiscoveryResult } from '../discovery-result.interface';
import { MatIconModule } from '@angular/material/icon';
import { ApplePodcastsSvgComponent } from '../apple-podcasts-svg/apple-podcasts-svg.component';
import { SearchResult } from '../search-result.interface';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-episode-image',
  imports: [
    MatIconModule,
    MatButtonModule,
    ApplePodcastsSvgComponent
  ],
  templateUrl: './episode-image.component.html',
  styleUrl: './episode-image.component.sass'
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

  overlayVisible: boolean = false;

  get imageUrl(): URL | undefined {
    let imageUrl: URL | undefined;
    if (this.searchResult) {
      imageUrl = this.searchResult.image;
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

  overlay($event: Event, show: boolean) {
    if (this.linksOverlay) {
      this.overlayVisible = show;
      $event.stopPropagation();
    }
  }

  get spotify(): URL | undefined {
    if (this.searchResult) {
      return this.searchResult.spotify;
    } else if (this.apiEpisode) {
      if (this.apiEpisode.urls.spotify) {
        if (typeof this.apiEpisode.urls.spotify !== 'string') {
          return this.apiEpisode.urls.spotify;
        } else {
          return new URL(this.apiEpisode.urls.spotify);
        }
      }
    } else if (this.discoveryResult) {
      return this.discoveryResult.urls.spotify;
    }
    return undefined;
  }

  get applePodcasts(): URL | undefined {
    if (this.searchResult) {
      return this.searchResult.apple;
    } else if (this.apiEpisode) {
      if (this.apiEpisode.urls.apple) {
        if (typeof this.apiEpisode.urls.apple !== 'string') {
          return this.apiEpisode.urls.apple;
        } else {
          return new URL(this.apiEpisode.urls.apple);
        }
      }
    } else if (this.discoveryResult) {
      return this.discoveryResult.urls.apple;
    }
    return undefined;
  }

  get youtube(): URL | undefined {
    if (this.searchResult) {
      return this.searchResult.youtube;
    } else if (this.apiEpisode) {
      if (this.apiEpisode.urls.youtube) {
        if (typeof this.apiEpisode.urls.youtube !== 'string') {
          return this.apiEpisode.urls.youtube;
        } else {
          return new URL(this.apiEpisode.urls.youtube);
        }
      }
    } else if (this.discoveryResult) {
      return this.discoveryResult.urls.youtube;
    }
    return undefined;
  }

  get bbc(): URL | undefined {
    if (this.searchResult) {
      return this.searchResult.bbc;
    } else if (this.apiEpisode) {
      if (this.apiEpisode.urls.bbc) {
        if (typeof this.apiEpisode.urls.bbc !== 'string') {
          return this.apiEpisode.urls.bbc;
        } else {
          return new URL(this.apiEpisode.urls.bbc);
        }
      }
    }
    return undefined;
  }

  get internetArchive(): URL | undefined {
    if (this.searchResult) {
      return this.searchResult.internetArchive;
    } else if (this.apiEpisode) {
      if (this.apiEpisode.urls.internetArchive) {
        if (typeof this.apiEpisode.urls.internetArchive !== 'string') {
          return this.apiEpisode.urls.internetArchive;
        } else {
          return new URL(this.apiEpisode.urls.internetArchive);
        }
      }
    }
    return undefined;
  }
}
