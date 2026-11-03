import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SearchResult } from '../search-result.interface';
import { PlayableDetailShellComponent } from '../playable-detail-shell/playable-detail-shell.component';

@Component({
  selector: 'app-playable-detail-episode',
  imports: [PlayableDetailShellComponent],
  templateUrl: './playable-detail-episode.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayableDetailEpisodeComponent {
  readonly episode = input.required<SearchResult>();
  readonly emitCuratorEdit = input(false);
  readonly curatorEdit = output<string>();
}
