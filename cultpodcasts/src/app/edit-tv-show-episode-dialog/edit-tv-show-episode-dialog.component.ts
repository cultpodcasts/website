import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PlayableEditFieldsComponent } from '../playable-edit-fields/playable-edit-fields.component';
import { PlayableEditDialogBase } from '../playable-edit-dialog.base';
import { PlayableEditFormValue, tvShowEpisodeChanges } from '../playable-edit-form.util';
import { TvShowEpisodeChangeRequest, TvShowEpisodeDto } from '../playable-edit.interface';

export interface EditTvShowEpisodeDialogData {
  episodeId: string;
  highlightDefaultLanguage?: boolean;
}

/**
 * Curator edit of a TV-show episode (GET/PATCH `tvshowepisode/{id}`), laid out like the podcast Edit Episode
 * dialog plus an Identity tab (IMDb / TheTVDB, from the old identity-only dialog).
 */
@Component({
  selector: 'app-edit-tv-show-episode-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, ReactiveFormsModule, PlayableEditFieldsComponent],
  templateUrl: './edit-tv-show-episode-dialog.component.html',
  styleUrl: './edit-tv-show-episode-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditTvShowEpisodeDialogComponent extends PlayableEditDialogBase<TvShowEpisodeDto, TvShowEpisodeChangeRequest> {
  readonly data = inject<EditTvShowEpisodeDialogData>(MAT_DIALOG_DATA);
  protected readonly hub = 'tv' as const;
  protected readonly variant = 'tv' as const;

  protected playableId(): string {
    return this.data.episodeId;
  }

  protected load(id: string) {
    return this.curation.getTvShowEpisode(id);
  }

  protected patch(id: string, changes: TvShowEpisodeChangeRequest) {
    return this.curation.patchTvShowEpisode(id, changes);
  }

  protected changes(original: TvShowEpisodeDto, value: PlayableEditFormValue, pendingUnBluesky: boolean): TvShowEpisodeChangeRequest {
    return tvShowEpisodeChanges(original, value, pendingUnBluesky);
  }

  protected parentOf(dto: TvShowEpisodeDto) {
    return { id: dto.tvShowId, name: dto.tvShowName ?? '' };
  }
}
