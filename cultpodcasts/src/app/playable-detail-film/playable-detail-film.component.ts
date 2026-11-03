import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SearchResult } from '../search-result.interface';
import { PlayableDetailShellComponent } from '../playable-detail-shell/playable-detail-shell.component';

@Component({
  selector: 'app-playable-detail-film',
  imports: [PlayableDetailShellComponent],
  templateUrl: './playable-detail-film.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayableDetailFilmComponent {
  /** Search hit for this film (shared SearchResult wire; no separate Film search DTO). */
  readonly film = input.required<SearchResult>();
  readonly emitCuratorEdit = input(false);
  readonly curatorEdit = output<string>();
}
