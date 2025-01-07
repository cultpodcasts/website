import { Component, Input } from '@angular/core';
import { ApiEpisode } from '../api-episode.interface';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-episode-status',
  imports: [
    MatIconModule
  ],
  templateUrl: './episode-status.component.html',
  styleUrl: './episode-status.component.sass'
})
export class EpisodeStatusComponent {
  protected _episode: ApiEpisode | undefined;
  @Input({ required: true })
  set episode(e: ApiEpisode) {
    this._episode = e;
  }
}
