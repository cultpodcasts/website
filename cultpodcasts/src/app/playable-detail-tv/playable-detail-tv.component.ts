import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CataloguePlayableKind } from '../catalogue-playable-kind.enum';
import { SearchResult } from '../search-result.interface';
import { PlayableDetailShellComponent } from '../playable-detail-shell/playable-detail-shell.component';

@Component({
  selector: 'app-playable-detail-tv',
  imports: [PlayableDetailShellComponent],
  templateUrl: './playable-detail-tv.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayableDetailTvComponent {
  /** Search hit for this TV episode (shared SearchResult wire; curator edit uses TvShowEpisodeDto). */
  readonly tvShowEpisode = input.required<SearchResult>();
  readonly emitCuratorEdit = input(false);
  readonly curatorEdit = output<string>();
  protected readonly moreFromKind = CataloguePlayableKind.TvShowEpisode;
}
