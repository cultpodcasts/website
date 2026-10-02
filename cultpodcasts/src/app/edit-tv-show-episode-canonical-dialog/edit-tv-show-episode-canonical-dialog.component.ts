import { Component, Inject, ChangeDetectionStrategy, signal, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { hasNonEmptyUrlValue, openExternalUrl } from '../episode-form.util';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';

@Component({
  selector: 'app-edit-tv-show-episode-canonical-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './edit-tv-show-episode-canonical-dialog.component.html',
  styleUrl: './edit-tv-show-episode-canonical-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditTvShowEpisodeCanonicalDialogComponent implements OnInit {
  protected readonly hasNonEmptyUrlValue = hasNonEmptyUrlValue;
  protected readonly openExternalUrl = openExternalUrl;
  readonly isLoading = signal(true);
  readonly isInError = signal(false);
  readonly isSaving = signal(false);
  readonly title = signal('');
  readonly form = new FormGroup({
    imdb: new FormControl('', { nonNullable: true }),
    tvdb: new FormControl('', { nonNullable: true })
  });

  constructor(
    private curationSubmit: CurationSubmitService,
    private dialogRef: MatDialogRef<EditTvShowEpisodeCanonicalDialogComponent, EditEpisodeDialogResponse>,
    @Inject(MAT_DIALOG_DATA) public data: { episodeId: string }
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const dto = await firstValueFrom(this.curationSubmit.getTvShowEpisode(this.data.episodeId));
      this.title.set(dto.title);
      this.form.setValue({
        imdb: dto.imdb ?? '',
        tvdb: dto.tvdb ?? ''
      });
      this.isLoading.set(false);
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
      this.isInError.set(true);
    }
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  clearField(control: FormControl<string>) {
    control.setValue('');
    control.markAsDirty();
  }

  async onSubmit(): Promise<void> {
    if (this.form.pristine) {
      this.dialogRef.close({ noChange: true });
      return;
    }
    this.isSaving.set(true);
    try {
      await firstValueFrom(this.curationSubmit.postTvShowEpisode(this.data.episodeId, {
        imdb: this.form.controls.imdb.value,
        tvdb: this.form.controls.tvdb.value
      }));
      this.dialogRef.close({ updated: true });
    } catch (e) {
      console.error(e);
      this.isSaving.set(false);
      this.isInError.set(true);
    }
  }
}
