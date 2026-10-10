import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';

@Component({
  selector: 'app-subjects',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    SubjectChipComponent,
  ],
  templateUrl: './subjects.component.html',
  styleUrl: './subjects.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubjectsComponent {
  @Input({ required: true })
  subjects: string[] = [];

  @Input()
  showHidden: boolean = false;

  /** Optional per-subject explanation (e.g. why it matched), shown as a tooltip. */
  @Input()
  reasons: Record<string, string> | null = null;

  @Input()
  stopPropagation: boolean = false;

  @Input()
  editable: boolean = false;

  @Input()
  disabled: boolean = false;

  /** Subject name currently being removed (in-flight). */
  @Input()
  loadingSubjectName: string | null = null;

  @Output()
  removeSubject = new EventEmitter<string>();

  stopPropagate($event: Event) {
    if (this.stopPropagation) {
      $event.stopPropagation();
    }
  }

  reasonFor(subject: string): string {
    return this.reasons && Object.hasOwn(this.reasons, subject) ? this.reasons[subject] : '';
  }

  isSubjectLoading(subject: string): boolean {
    return !!this.loadingSubjectName && this.loadingSubjectName === subject;
  }

  onRemove(subject: string, $event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.removeSubject.emit(subject);
  }
}
