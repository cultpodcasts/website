import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ApiEpisode } from '../api-episode.interface';
import { ClampableTextComponent } from '../clampable-text/clampable-text.component';
import { EpisodeGuestsComponent } from '../episode-guests/episode-guests.component';
import { EpisodePodcastLinksComponent } from '../episode-podcast-links/episode-podcast-links.component';
import { EpisodeStatusComponent } from '../episode-status/episode-status.component';
import { peopleFromDto, personMatchesFromDto } from '../person-dto.util';
import { subjectMatchReasons } from '../subject-match-reasons';
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

  /** Same tooltip text discovery review uses: the term and field that triggered each subject. */
  protected readonly subjectReasons = computed(() => subjectMatchReasons(this.episode().matches));
  /** Wire `PersonDto` guests mapped to the UI `Person` (person-dto.util). */
  protected readonly guestPeople = computed(() => peopleFromDto(this.episode().guestPeople));
  protected readonly guestSuggestions = computed(() => personMatchesFromDto(this.episode().guestSuggestions));

  readonly removeSubject = output<string>();
  readonly removeGuest = output<string>();
  readonly addSuggestedGuest = output<string>();
  readonly toggleIgnored = output<void>();
  readonly toggleRemoved = output<void>();
  readonly toggleTweeted = output<void>();
  readonly toggleBluesky = output<void>();
}
