import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, input } from '@angular/core';
import { CataloguePlayableKind } from '../catalogue-playable-kind.enum';
import { SearchResult } from '../search-result.interface';
import { PlayableDetailShellComponent } from '../playable-detail-shell/playable-detail-shell.component';

@Component({
  selector: 'app-playable-detail-news',
  imports: [PlayableDetailShellComponent],
  templateUrl: './playable-detail-news.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayableDetailNewsComponent {
  /** Search hit for this news report (shared SearchResult wire; curator edit uses NewsReportDto). */
  readonly newsReport = input.required<SearchResult>();
  @Input() emitCuratorEdit = false;
  @Output() curatorEdit = new EventEmitter<string>();
  protected readonly moreFromKind = CataloguePlayableKind.NewsReport;
}
