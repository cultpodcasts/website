import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Person } from '../person.interface';
import { PersonMatch } from '../person-match.interface';

@Component({
  selector: 'app-episode-guests',
  imports: [
    MatIconModule
  ],
  templateUrl: './episode-guests.component.html',
  styleUrl: './episode-guests.component.sass'
})
export class EpisodeGuestsComponent {
  @Input()
  guestPeople: Person[] | undefined;

  @Input()
  guestSuggestions: PersonMatch[] | undefined;

  personLabel(person: Person): string {
    const handles = [person.twitterHandle, person.blueskyHandle].filter(x => !!x).join(' ');
    return handles ? `${person.name} (${handles})` : person.name;
  }

  suggestionLabel(suggestion: PersonMatch): string {
    const term = suggestion.matchResults[0]?.term;
    return term
      ? `${this.personLabel(suggestion.person)} (${term})`
      : this.personLabel(suggestion.person);
  }
}
