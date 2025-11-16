import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-subjects',
  imports: [
    RouterLink
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

  propagate($event: Event) {
    if (this.stopPropagation) {
      $event.stopPropagation();
    }
  }
}
