import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PlayableEditFieldsComponent } from '../playable-edit-fields/playable-edit-fields.component';
import { PlayableEditDialogBase } from '../playable-edit-dialog.base';
import { PlayableEditFormValue, playableFieldsChanges } from '../playable-edit-form.util';
import { NewsReportChangeRequest, NewsReportDto } from '../playable-edit.interface';

export interface EditNewsReportDialogData {
  reportId: string;
}

/** Curator edit of a news report (GET/PATCH `newsreport/{id}`), laid out like the podcast Edit Episode dialog. */
@Component({
  selector: 'app-edit-news-report-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, ReactiveFormsModule, PlayableEditFieldsComponent],
  templateUrl: './edit-news-report-dialog.component.html',
  styleUrl: './edit-news-report-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditNewsReportDialogComponent extends PlayableEditDialogBase<NewsReportDto, NewsReportChangeRequest> {
  readonly data = inject<EditNewsReportDialogData>(MAT_DIALOG_DATA);
  protected readonly hub = 'news' as const;
  protected readonly identity = false;

  protected playableId(): string {
    return this.data.reportId;
  }

  protected load(id: string) {
    return this.curation.getNewsReport(id);
  }

  protected patch(id: string, changes: NewsReportChangeRequest) {
    return this.curation.patchNewsReport(id, changes);
  }

  protected changes(original: NewsReportDto, value: PlayableEditFormValue, pendingUnBluesky: boolean): NewsReportChangeRequest {
    return playableFieldsChanges(original, value, pendingUnBluesky);
  }

  protected parentOf(dto: NewsReportDto) {
    return { id: dto.newsOrganisationId, name: dto.newsOrganisationName ?? '' };
  }
}
