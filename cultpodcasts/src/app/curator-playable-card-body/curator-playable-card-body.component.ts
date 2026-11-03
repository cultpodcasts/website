import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ApiEpisode } from '../api-episode.interface';
import { ClampableTextComponent } from '../clampable-text/clampable-text.component';
import { EpisodeGuestsComponent } from '../episode-guests/episode-guests.component';
import { EpisodePodcastLinksComponent } from '../episode-podcast-links/episode-podcast-links.component';
import { EpisodeStatusComponent } from '../episode-status/episode-status.component';
import { SubjectsComponent } from '../subjects/subjects.component';

/** Shared curator card middle: description, subjects, guests, platforms, status. No contentKind branching. */
@Component({
  selector: 'app-curator-playable-card-body',
  imports: [
    MatCardModule,
    ClampableTextComponent,
    SubjectsComponent,
    EpisodeGuestsComponent,
    EpisodePodcastLinksComponent,
    EpisodeStatusComponent,
  ],
  templateUrl: './curator-playable-card-body.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuratorPlayableCardBodyComponent {
  readonly episode = input.required<ApiEpisode>();
  readonly updating = input(false);
  readonly loadingSubjectName = input<string | null>(null);
  readonly loadingGuestName = input<string | null>(null);
  readonly loadingIgnored = input(false);
  readonly loadingRemoved = input(false);
  readonly loadingTweeted = input(false);
  readonly loadingBluesky = input(false);
  readonly statusActionLoading = input(false);

  readonly removeSubject = output<string>();
  readonly removeGuest = output<string>();
  readonly addSuggestedGuest = output<string>();
  readonly toggleIgnored = output<void>();
  readonly toggleRemoved = output<void>();
  readonly toggleTweeted = output<void>();
  readonly toggleBluesky = output<void>();
}
