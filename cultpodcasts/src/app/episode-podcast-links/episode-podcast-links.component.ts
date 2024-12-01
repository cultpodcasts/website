import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Episode } from '../episode';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-episode-podcast-links',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './episode-podcast-links.component.html',
  styleUrl: './episode-podcast-links.component.sass'
})
export class EpisodePodcastLinksComponent {
  protected _episode: Episode | undefined;
  @Input({ required: true })
  set episode(e: Episode) {
    this._episode = e;
  }
}
