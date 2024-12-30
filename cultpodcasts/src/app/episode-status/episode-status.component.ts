import { Component, Input } from '@angular/core';
import { Episode } from '../episode';
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
  protected _episode: Episode | undefined;
  @Input({ required: true })
  set episode(e: Episode) {
    this._episode = e;
  }
}
