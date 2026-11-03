import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ApiEpisode } from '../api-episode.interface';
import { CuratorEpisodeCardComponent } from '../curator-episode-card/curator-episode-card.component';
import { CuratorFilmCardComponent } from '../curator-film-card/curator-film-card.component';
import { CuratorNewsReportCardComponent } from '../curator-news-report-card/curator-news-report-card.component';
import { CuratorTvShowEpisodeCardComponent } from '../curator-tv-show-episode-card/curator-tv-show-episode-card.component';
import { EditPodcastDialogData } from '../edit-podcast-dialog-data.interface';

/** List boundary for curator playables — same role as `catalogue-card` for browse. */
@Component({
  selector: 'app-curator-playable-card',
  imports: [
    CuratorEpisodeCardComponent,
    CuratorFilmCardComponent,
    CuratorTvShowEpisodeCardComponent,
    CuratorNewsReportCardComponent,
  ],
  templateUrl: './curator-playable-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuratorPlayableCardComponent {
  readonly episode = input.required<ApiEpisode>();
  readonly showPromote = input(false);
  readonly promoted = input(false);
  readonly titleAsLink = input(true);
  readonly showIndexPodcast = input(false);
  readonly showDeleteEpisode = input(false);
  readonly authRoles = input<readonly string[]>([]);
  readonly updating = input(false);
  readonly loadingSubjectName = input<string | null>(null);
  readonly loadingGuestName = input<string | null>(null);
  readonly loadingIgnored = input(false);
  readonly loadingRemoved = input(false);
  readonly loadingTweeted = input(false);
  readonly loadingBluesky = input(false);
  readonly statusActionLoading = input(false);

  readonly edit = output<ApiEpisode>();
  readonly post = output<ApiEpisode>();
  readonly editPodcast = output<EditPodcastDialogData>();
  readonly indexPodcast = output<string>();
  readonly deleteEpisode = output<{ podcastId: string; episodeId: string }>();
  readonly promoteToggle = output<ApiEpisode>();
  readonly removeSubject = output<{ episode: ApiEpisode; subject: string }>();
  readonly removeGuest = output<{ episode: ApiEpisode; guestName: string }>();
  readonly addSuggestedGuest = output<{ episode: ApiEpisode; name: string }>();
  readonly toggleIgnored = output<ApiEpisode>();
  readonly toggleRemoved = output<ApiEpisode>();
  readonly toggleTweeted = output<ApiEpisode>();
  readonly toggleBluesky = output<ApiEpisode>();
}
