import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApiEpisode } from '../api-episode.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";
import {
  collectEpisodeServices,
  DEFAULT_UI_SERVICE_KEYS,
  isDefaultUiService,
  serviceDescriptor,
  type EpisodeServiceItem
} from '../service-catalog';

type PodcastLinkRow = Omit<EpisodeServiceItem, "url"> & { url?: URL; placeholder: boolean };

@Component({
  selector: 'app-episode-podcast-links',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule,
    ApplePodcastsSvgComponent
  ],
  templateUrl: './episode-podcast-links.component.html',
  styleUrl: './episode-podcast-links.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpisodePodcastLinksComponent {

  protected _episode: ApiEpisode | undefined;

  protected serviceRows(): PodcastLinkRow[] {
    const collected = collectEpisodeServices({
      youtube: this.asUrl(this._episode?.urls?.youtube),
      spotify: this.asUrl(this._episode?.urls?.spotify),
      apple: this.asUrl(this._episode?.urls?.apple),
      bbc: this.asUrl(this._episode?.urls?.bbc),
      internetArchive: this.asUrl(this._episode?.urls?.internetArchive),
      services: this._episode?.services
    });
    const byKey = new Map(collected.map((item) => [item.key, item]));
    const rows: PodcastLinkRow[] = [];
    for (const key of DEFAULT_UI_SERVICE_KEYS) {
      const item = byKey.get(key);
      if (item) {
        rows.push({ ...item, placeholder: false });
      } else if (this.podcastHasService(key)) {
        const descriptor = serviceDescriptor(key);
        rows.push({
          key,
          icon: descriptor.icon,
          displayName: descriptor.displayName,
          usesAppleMark: key === "apple",
          placeholder: true
        });
      }
    }
    for (const item of collected) {
      if (!isDefaultUiService(item.key)) {
        rows.push({ ...item, placeholder: false });
      }
    }
    return rows;
  }

  private podcastHasService(key: string): boolean {
    if (key === "youtube") {
      return !!this._episode?.youTubePodcast;
    }
    if (key === "spotify") {
      return !!this._episode?.spotifyPodcast;
    }
    if (key === "apple") {
      return !!this._episode?.applePodcast;
    }
    return false;
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

  @Input({ required: true })
  set episode(e: ApiEpisode) {
    this._episode = e;
  }
}
