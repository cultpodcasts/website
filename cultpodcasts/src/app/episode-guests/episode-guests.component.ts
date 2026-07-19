import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Person } from '../person.interface';
import { PersonMatch } from '../person-match.interface';

@Component({
  selector: 'app-episode-guests',
  imports: [
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './episode-guests.component.html',
  styleUrl: './episode-guests.component.sass'
})
export class EpisodeGuestsComponent {
  @Input()
  guestPeople: Person[] | undefined;

  @Input()
  guestSuggestions: PersonMatch[] | undefined;

  @Input()
  editable: boolean = false;

  @Input()
  disabled: boolean = false;

  @Output()
  removeGuest = new EventEmitter<string>();

  @Output()
  addSuggestedGuest = new EventEmitter<string>();

  personLabel(person: Person): string {
    return person.name;
  }

  suggestionLabel(suggestion: PersonMatch): string {
    return suggestion.person.name;
  }

  onRemoveGuest(guestName: string, $event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.removeGuest.emit(guestName);
  }

  onAddSuggestedGuest(guestName: string, $event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.addSuggestedGuest.emit(guestName);
  }
}
