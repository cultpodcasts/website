import { SearchResult } from '../search-result.interface';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { EpisodeLoadingSkeletonComponent } from '../episode-loading-skeleton/episode-loading-skeleton.component';
import { CataloguePlayableKind } from '../catalogue-playable-kind.enum';
import { catalogueParentLink } from '../catalogue-links';
import { PlayableDetailEpisodeComponent } from '../playable-detail-episode/playable-detail-episode.component';
import { PlayableDetailFilmComponent } from '../playable-detail-film/playable-detail-film.component';
import { PlayableDetailNewsComponent } from '../playable-detail-news/playable-detail-news.component';
import { PlayableDetailTvComponent } from '../playable-detail-tv/playable-detail-tv.component';

/**
 * Shared playable detail facade for hosts that do not know the kind up front
 * (podcast episode route, load/empty states).
 *
 * Dual entry (intentional):
 * - Known-kind routes (`film-page`, `news-report`, `tv-show-episode`) mount the
 *   kind leaf (`app-playable-detail-film` etc.) directly and bind curator wiring there.
 * - This facade keeps load/empty chrome and `@switch (contentKind)` onto the same
 *   leaves for the podcast route (and any other shared host).
 */
@Component({
  selector: 'app-podcast-episode',
  imports: [
    MatButtonModule,
    SiteLoadingComponent,
    EpisodeLoadingSkeletonComponent,
    PlayableDetailEpisodeComponent,
    PlayableDetailFilmComponent,
    PlayableDetailNewsComponent,
    PlayableDetailTvComponent,
  ],
  templateUrl: './podcast-episode.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ngSkipHydration: 'true' }
})
export class PodcastEpisodeComponent {
  private readonly router = inject(Router);

  protected readonly CataloguePlayableKind = CataloguePlayableKind;

  @Input()
  get episode(): SearchResult | undefined {
    return this._episode();
  }
  set episode(val: SearchResult | undefined) {
    this._episode.set(val);
    this.isLoading.set(false);
  }

  @Input()
  set parentLoaded(val: boolean) {
    this._parentLoaded = val;
    this.isLoading.set(!this._parentLoaded);
  }

  /**
   * When true, curator Edit emits `curatorEdit` instead of opening the podcast editor.
   * Kind pages bind this on the leaf, not here; set on this facade only when a host
   * still mounts `app-podcast-episode` and needs the same emit-instead-of-dialog behaviour.
   */
  @Input() emitCuratorEdit = false;

  /**
   * Curator edit bubbled from the selected kind leaf. Unbound by default on the podcast route.
   */
  @Output() curatorEdit = new EventEmitter<string>();

  private _episode = signal<SearchResult | undefined>(undefined);
  private _parentLoaded = false;

  isLoading = signal(true);

  /** Empty-state CTA: navigate to parent hub when one exists (no-op for Film). */
  podcastPage() {
    const ep = this._episode();
    if (ep?.contentKind === CataloguePlayableKind.Film) {
      return;
    }
    const commands = catalogueParentLink(ep) ?? (ep?.podcastName ? ["/podcast", ep.podcastName] : null);
    if (commands) {
      this.router.navigate(commands);
    }
  }
}
