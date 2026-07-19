import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-subjects',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './subjects.component.html',
  styleUrl: './subjects.component.sass'
})
export class SubjectsComponent {
  @Input({ required: true })
  subjects: string[] = [];

  @Input()
  showHidden: boolean = false;

  @Input()
  stopPropagation: boolean = false;

  @Input()
  editable: boolean = false;

  @Input()
  disabled: boolean = false;

  @Output()
  removeSubject = new EventEmitter<string>();

  stopPropagate($event: Event) {
    if (this.stopPropagation) {
      $event.stopPropagation();
    }
  }

  onRemove(subject: string, $event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.removeSubject.emit(subject);
  }
}
