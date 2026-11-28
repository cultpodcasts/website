import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CurationSubmitService } from '../curation-submit.service';
import { EpisodeRailComponent } from '../episode-rail/episode-rail.component';
import { startEpisodePlayback } from '../episode-embed';
import { PlayerService } from '../player.service';
import { SearchDisplayEpisode } from '../search-result-links';
import { TvShowTrailer, tvShowTrailerEpisodes } from '../tv-show-trailer';

/**
 * The TV show page's Trailers and extras rail (RPP #1412): the trailers, teasers and clips attached to the show from
 * podcast episodes, in display order, as rail cards (a YouTube one plays in the site player, others open their video).
 *
 * A TV show has no search document, so the only source is the curator `GET tvshow/{name}`. The rail is therefore
 * curator-only: anyone else (and a show that cannot be looked up, or has none) renders nothing and makes no request.
 * It sits outside the episode list so a show that holds only trailers (created by attaching one) still lists them.
 * `reload()` refreshes it after the show was edited.
 */
@Component({
  selector: 'app-tv-show-trailers',
  imports: [EpisodeRailComponent],
  templateUrl: './tv-show-trailers.component.html',
  styleUrl: './tv-show-trailers.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvShowTrailersComponent {
  private readonly playerService = inject(PlayerService);
  private readonly curation = inject(CurationSubmitService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roles = toSignal(inject(AuthServiceWrapper).roles, { initialValue: [] as string[] });
  private loading: Subscription | undefined;

  /** The show's name (the `/tv/{name}` slug). */
  readonly showName = input.required<string>();

  protected readonly isCurator = computed(() => this.roles().includes('Curator'));
  private readonly show = signal<{ id: string; name: string; trailers: readonly TvShowTrailer[] } | null>(null);
  protected readonly episodes = computed(() => {
    const show = this.show();
    return show ? tvShowTrailerEpisodes(show.trailers, show.id, show.name) : [];
  });
  protected readonly playingEpisodeId = computed(() => this.playerService.episode()?.id);

  constructor() {
    effect(() => {
      const name = this.showName();
      const curator = this.isCurator();
      untracked(() => this.load(curator ? name : ''));
    });
  }

  /** Reads the show again (after an edit changed its trailers). */
  reload(): void {
    this.load(this.isCurator() ? this.showName() : '');
  }

  private load(name: string): void {
    this.loading?.unsubscribe();
    this.show.set(null);
    if (!name.trim()) {
      return;
    }
    this.loading = this.curation.getCatalogueParent('tv', name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (show) => this.show.set({ id: show.id, name: show.name || name, trailers: show.trailers ?? [] }),
      // A missing or ambiguous name, or a failed read, just shows no rail: the page itself is unaffected.
      error: () => this.show.set(null),
    });
  }

  protected play(episode: SearchDisplayEpisode): void {
    startEpisodePlayback(episode, (playable) => this.playerService.play(playable));
  }
}
