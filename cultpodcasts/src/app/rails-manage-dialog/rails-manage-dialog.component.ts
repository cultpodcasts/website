import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, Inject, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HeroCurationService } from '../hero-curation.service';
import { displayCatalogName } from '../display-catalog-name';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';

export interface RailsManageDialogData {
  pinned: string[];
  /** Eligible subjects this week, popularity-sorted. */
  eligible: string[];
  /** Episode count this week, keyed by subject name. */
  episodeCounts: Record<string, number>;
}

export interface RailsManageDialogResult {
  saved: boolean;
  railSubjects?: string[];
}

@Component({
  selector: 'app-rails-manage-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
    SubjectChipComponent,
  ],
  templateUrl: './rails-manage-dialog.component.html',
  styleUrl: './rails-manage-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RailsManageDialogComponent {
  private readonly heroCuration = inject(HeroCurationService);
  private readonly dialogRef = inject(
    MatDialogRef<RailsManageDialogComponent, RailsManageDialogResult>
  );

  protected readonly pinned = signal<string[]>([]);
  private readonly eligible: string[];
  private readonly episodeCounts: Record<string, number>;
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly displayCatalogName = displayCatalogName;

  /** Eligible subjects not currently pinned. */
  protected readonly available = computed(() => {
    const pinned = new Set(this.pinned());
    return this.eligible.filter((subject) => !pinned.has(subject));
  });

  constructor(@Inject(MAT_DIALOG_DATA) data: RailsManageDialogData) {
    this.pinned.set([...data.pinned]);
    this.eligible = data.eligible;
    this.episodeCounts = data.episodeCounts ?? {};
  }

  episodeCount(subject: string): number {
    return this.episodeCounts[subject] ?? 0;
  }

  drop(event: CdkDragDrop<string[]>): void {
    const list = [...this.pinned()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.pinned.set(list);
  }

  remove(subject: string): void {
    this.pinned.set(this.pinned().filter((s) => s !== subject));
  }

  pin(subject: string): void {
    if (this.pinned().includes(subject)) {
      return;
    }
    this.pinned.set([...this.pinned(), subject]);
  }

  close(): void {
    this.dialogRef.close({ saved: false });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(false);
    try {
      const result = await this.heroCuration.setRailSubjects(this.pinned());
      this.dialogRef.close({ saved: true, railSubjects: result.railSubjects });
    } catch {
      this.error.set(true);
      this.saving.set(false);
    }
  }
}
