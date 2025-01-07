import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApiEpisode } from '../api-episode.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";

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
  styleUrl: './episode-podcast-links.component.sass'
})
export class EpisodePodcastLinksComponent {
  protected _episode: ApiEpisode | undefined;
  @Input({ required: true })
  set episode(e: ApiEpisode) {
    this._episode = e;
  }
}
