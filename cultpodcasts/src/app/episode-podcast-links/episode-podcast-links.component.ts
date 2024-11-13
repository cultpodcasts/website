import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Episode } from '../episode';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { EpisodeStatusComponent } from '../episode-status/episode-status.component';

@Component({
  selector: 'app-episode-podcast-links',
  standalone: true,
  imports: [
    NgIf,
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgClass,
    NgFor,
    MatCardModule,
    RouterLink,
    DatePipe,
    EpisodeStatusComponent
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
