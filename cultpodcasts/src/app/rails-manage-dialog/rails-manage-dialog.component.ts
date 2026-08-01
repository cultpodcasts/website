import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, Inject, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HeroCurationConflictError, HeroCurationService } from '../hero-curation.service';
import { displayCatalogName } from '../display-catalog-name';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';
import {
  dayRailLabel,
  isDayRailEntry,
  parseDayRailOffset,
  subjectEntries,
} from '../rail-order';

export interface RailsManageDialogData {
  /** Mixed order: `day:{offset}` slots and subject names. */
  order: string[];
  /** Eligible subjects this week, popularity-sorted. */
  eligible: string[];
  /** Episode count this week, keyed by subject name. */
  episodeCounts: Record<string, number>;
  /** Episode count per relative day offset (0 = n). */
  dayEpisodeCounts: number[];
  updatedAt: string | null;
}

export interface RailsManageDialogResult {
  saved: boolean;
  railSubjects?: string[];
  updatedAt?: string | null;
  conflict?: boolean;
}

export interface RailsManageRow {
  id: string;
  kind: 'day' | 'subject';
  /** Subject name or day label (n, n−1, …). */
  label: string;
  episodeCount: number;
  locked: boolean;
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

  protected readonly order = signal<string[]>([]);
  private readonly eligible: string[];
  private readonly episodeCounts: Record<string, number>;
  private readonly dayEpisodeCounts: number[];
  private readonly expectedUpdatedAt: string | null;
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly conflict = signal(false);
  protected readonly displayCatalogName = displayCatalogName;

  protected readonly rows = computed((): RailsManageRow[] =>
    this.order().map((id) => this.toRow(id))
  );

  /** Eligible subjects not currently pinned. */
  protected readonly available = computed(() => {
    const pinned = new Set(subjectEntries(this.order()));
    return this.eligible.filter((subject) => !pinned.has(subject));
  });

  constructor(@Inject(MAT_DIALOG_DATA) data: RailsManageDialogData) {
    this.order.set([...data.order]);
    this.eligible = data.eligible;
    this.episodeCounts = data.episodeCounts ?? {};
    this.dayEpisodeCounts = data.dayEpisodeCounts ?? [];
    this.expectedUpdatedAt = data.updatedAt;
  }

  episodeCount(subject: string): number {
    return this.episodeCounts[subject] ?? 0;
  }

  drop(event: CdkDragDrop<string[]>): void {
    const list = [...this.order()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.order.set(list);
  }

  remove(subject: string): void {
    if (isDayRailEntry(subject)) {
      return;
    }
    this.order.set(this.order().filter((s) => s !== subject));
  }

  pin(subject: string): void {
    if (this.order().includes(subject)) {
      return;
    }
    this.order.set([...this.order(), subject]);
  }

  close(): void {
    this.dialogRef.close({ saved: false });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(false);
    this.conflict.set(false);
    try {
      const result = await this.heroCuration.setRailSubjects(
        this.order(),
        this.expectedUpdatedAt
      );
      this.dialogRef.close({
        saved: true,
        railSubjects: result.railSubjects,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      if (error instanceof HeroCurationConflictError) {
        this.conflict.set(true);
        this.dialogRef.close({
          saved: false,
          conflict: true,
          railSubjects: error.current.railSubjects,
          updatedAt: error.current.updatedAt,
        });
        return;
      }
      this.error.set(true);
      this.saving.set(false);
    }
  }

  private toRow(id: string): RailsManageRow {
    const offset = parseDayRailOffset(id);
    if (offset !== null) {
      return {
        id,
        kind: 'day',
        label: dayRailLabel(offset),
        episodeCount: this.dayEpisodeCounts[offset] ?? 0,
        locked: true,
      };
    }
    return {
      id,
      kind: 'subject',
      label: id,
      episodeCount: this.episodeCounts[id] ?? 0,
      locked: false,
    };
  }
}
