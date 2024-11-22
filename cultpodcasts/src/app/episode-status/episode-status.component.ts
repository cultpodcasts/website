import { Component, Input } from '@angular/core';
import { Episode } from '../episode';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-episode-status',
  imports: [
    NgClass,
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
