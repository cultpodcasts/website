import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, Inject, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HomepageEpisode } from '../homepage-episode.interface';
import { HeroCurationConflictError, HeroCurationService } from '../hero-curation.service';
import { episodeImageUrl } from '../search-result-links';
import { displayCatalogName } from '../display-catalog-name';

export interface HeroManageDialogData {
  curated: HomepageEpisode[];
  autofilled: HomepageEpisode[];
  updatedAt: string | null;
}

export interface HeroManageDialogResult {
  saved: boolean;
  episodeIds?: string[];
  updatedAt?: string | null;
  conflict?: boolean;
}

@Component({
  selector: 'app-hero-manage-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
  ],
  templateUrl: './hero-manage-dialog.component.html',
  styleUrl: './hero-manage-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroManageDialogComponent {
  private readonly heroCuration = inject(HeroCurationService);
  private readonly dialogRef = inject(MatDialogRef<HeroManageDialogComponent, HeroManageDialogResult>);

  protected readonly curated = signal<HomepageEpisode[]>([]);
  protected readonly autofilled: HomepageEpisode[];
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly conflict = signal(false);
  protected readonly displayCatalogName = displayCatalogName;
  private readonly expectedUpdatedAt: string | null;

  constructor(@Inject(MAT_DIALOG_DATA) data: HeroManageDialogData) {
    this.curated.set([...data.curated]);
    this.autofilled = data.autofilled;
    this.expectedUpdatedAt = data.updatedAt;
  }

  thumb(ep: HomepageEpisode): string | undefined {
    return episodeImageUrl(ep)?.toString();
  }

  drop(event: CdkDragDrop<HomepageEpisode[]>): void {
    const list = [...this.curated()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.curated.set(list);
  }

  remove(id: string): void {
    this.curated.set(this.curated().filter((ep) => ep.id !== id));
  }

  close(): void {
    this.dialogRef.close({ saved: false });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(false);
    this.conflict.set(false);
    const ids = this.curated().map((ep) => ep.id);
    try {
      const result = await this.heroCuration.setHeroCuration(ids, this.expectedUpdatedAt);
      this.dialogRef.close({
        saved: true,
        episodeIds: result.episodeIds,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      if (error instanceof HeroCurationConflictError) {
        this.conflict.set(true);
        this.dialogRef.close({
          saved: false,
          conflict: true,
          episodeIds: error.current.episodeIds,
          updatedAt: error.current.updatedAt,
        });
        return;
      }
      this.error.set(true);
      this.saving.set(false);
    }
  }
}
