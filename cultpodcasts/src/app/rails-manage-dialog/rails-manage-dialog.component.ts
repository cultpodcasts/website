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
  /** Subjects currently shown via autofill (not pinned). */
  autofilled: string[];
  /** Eligible subjects this week, popularity-sorted. */
  eligible: string[];
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
  private readonly initialAutofilled: string[];
  private readonly eligible: string[];
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly displayCatalogName = displayCatalogName;

  protected readonly autofilled = computed(() => {
    const pinned = new Set(this.pinned());
    return this.initialAutofilled.filter((subject) => !pinned.has(subject));
  });

  /** Eligible subjects neither pinned nor currently autofilled on screen. */
  protected readonly moreAvailable = computed(() => {
    const pinned = new Set(this.pinned());
    const autofilled = new Set(this.initialAutofilled);
    return this.eligible.filter(
      (subject) => !pinned.has(subject) && !autofilled.has(subject)
    );
  });

  constructor(@Inject(MAT_DIALOG_DATA) data: RailsManageDialogData) {
    this.pinned.set([...data.pinned]);
    this.initialAutofilled = data.autofilled;
    this.eligible = data.eligible;
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
