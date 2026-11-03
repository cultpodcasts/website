import { SearchResult } from '../search-result.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { combineLatest } from 'rxjs';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { SiteService } from '../site.service';
import { ODataService } from '../odata.service';
import { environment } from './../../environments/environment';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { EpisodeLinksComponent } from "../episode-links/episode-links.component";
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { EpisodeRailComponent } from '../episode-rail/episode-rail.component';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';
import { ContentKindBadgeComponent } from '../content-kind-badge/content-kind-badge.component';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { SearchDescriptionPipe } from '../search-description.pipe';
import { displayCatalogName } from '../display-catalog-name';
import { releaseDateLabel } from '../release-label';
import { SearchDisplayEpisode, episodeImageUrl } from '../search-result-links';
import { QueueButtonComponent } from '../queue-button/queue-button.component';
import { canPlayEpisode, playActionLabel, startEpisodePlayback } from '../episode-embed';
import { PlayerService } from '../player.service';
import { languageFlagBadgeForEpisode } from '../language-flag';
import { Component, DestroyRef, EventEmitter, inject, Input, Output, ChangeDetectionStrategy, signal, computed, effect, PLATFORM_ID, input } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { catalogueParentLink } from '../catalogue-links';
import { contentKindEquals, isUnknownSearchFieldError, normalizePlayableHit, podcastNameEquals, seriesNameEquals } from '../playable-search-hit';
import { ViewerLocaleService } from '../viewer-locale';

interface SubjectRail {
  subject: string;
  episodes: SearchResult[];
}

const RELATED_RAIL_SIZE = 12;
const MAX_SUBJECT_RAILS = 4;

/**
 * Shared playable detail billboard + related rails.
 * Kind policy (parent rail, aria copy, OData kind filter, actions label) comes from leaf inputs — no contentKind forks.
 */
@Component({
  selector: 'app-playable-detail-shell',
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    RouterLink,
    EpisodeLinksComponent,
    BookmarkComponent,
    EpisodeRailComponent,
    SubjectChipComponent,
    ContentKindBadgeComponent,
    QueueButtonComponent,
    SearchDescriptionPipe
  ],
  templateUrl: './playable-detail-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './playable-detail-shell.component.sass',
  host: { ngSkipHydration: 'true' }
})
export class PlayableDetailShellComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewerLocale = inject(ViewerLocaleService).locale;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthServiceWrapper);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly siteService = inject(SiteService);
  private readonly oDataService = inject(ODataService);
  protected readonly playerService = inject(PlayerService);

  readonly playable = input.required<SearchResult>();
  /** Parent "More from" rail + hero pill. False for Film (no parent). */
  readonly includeParentRail = input(true);
  /** Accessible name for the parent "More from" rail. */
  readonly moreFromAriaLabel = input('More from this podcast');
  /** Optional contentKind filter for More-from OData (News / TV). */
  readonly moreFromKindFilter = input<string | undefined>(undefined);
  readonly actionsAriaLabel = input('Episode actions');
  readonly editMenuLabel = input('Edit Episode');
  readonly postMenuLabel = input('Post Episode');

  /**
   * When true, curator Edit emits `curatorEdit` instead of opening the podcast editor.
   */
  @Input() emitCuratorEdit = false;

  @Output() curatorEdit = new EventEmitter<string>();

  podcastName = signal("");
  protected readonly showName = computed(() => this.playable()?.podcastName || this.podcastName());
  protected readonly parentLink = computed(() => {
    if (!this.includeParentRail()) {
      return null;
    }
    const ep = this.playable();
    return catalogueParentLink(ep) ?? (this.podcastName() ? ["/podcast", this.podcastName()] : null);
  });
  protected readonly displayCatalogName = displayCatalogName;
  protected readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });

  protected readonly canPlay = computed(() => canPlayEpisode(this.playable()));
  protected readonly playLabel = computed(() => playActionLabel(this.playable()));

  protected readonly duration = computed(() => {
    const cleaned = (this.playable().duration ?? '').split('.')[0];
    return cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
  });

  protected readonly releaseLabel = computed(() =>
    releaseDateLabel(this.playable().release)
  );

  protected readonly backdropUrl = computed(() =>
    episodeImageUrl(this.playable())?.toString()
  );

  protected readonly backdropAspect = signal<number | undefined>(undefined);
  protected readonly backdropKenBurns = signal(false);

  protected readonly visibleSubjects = computed(() =>
    (this.playable().subjects ?? []).filter((s) => !s.startsWith('_'))
  );

  protected readonly languageFlag = computed(() =>
    languageFlagBadgeForEpisode(this.playable(), this.viewerLocale())
  );

  protected readonly morePodcastEpisodes = signal<SearchResult[]>([]);
  protected readonly subjectRails = signal<SubjectRail[]>([]);
  protected readonly relatedLoading = signal<boolean>(false);

  private lastRelatedKey: string | undefined;
  private readonly platformId = inject(PLATFORM_ID);
  private backdropAspectToken = 0;
  private motionQuery: MediaQueryList | undefined;
  private gpuQuery: MediaQueryList | undefined;
  private reduceMotion = false;
  private saveGpu = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.gpuQuery = window.matchMedia(
        '(max-width: 900px), (hover: none) and (pointer: coarse)'
      );
      this.syncMotionFlags();
      this.motionQuery.addEventListener('change', this.onMotionQueryChange);
      this.gpuQuery.addEventListener('change', this.onMotionQueryChange);
      this.destroyRef.onDestroy(() => {
        this.motionQuery?.removeEventListener('change', this.onMotionQueryChange);
        this.gpuQuery?.removeEventListener('change', this.onMotionQueryChange);
      });
    }

    effect(() => {
      this.loadBackdropAspect(this.backdropUrl());
    });

    effect(() => {
      const ep = this.playable();
      const podcast = ep.podcastName || this.podcastName();
      // Re-read kind policy so leaf input changes retarget related loads.
      const includeParent = this.includeParentRail();
      const kindFilter = this.moreFromKindFilter();
      if (!podcast) {
        return;
      }
      const key = `${podcast}::${ep.id}::${includeParent}::${kindFilter ?? ''}`;
      if (key === this.lastRelatedKey) {
        return;
      }
      this.lastRelatedKey = key;
      this.loadRelated(ep, podcast);
    });

    this.populatePage();
  }

  private readonly onMotionQueryChange = () => {
    this.syncMotionFlags();
    this.backdropKenBurns.set(!!this.backdropUrl() && this.kenBurnsAllowed());
  };

  private syncMotionFlags(): void {
    this.reduceMotion = !!this.motionQuery?.matches;
    this.saveGpu = !!this.gpuQuery?.matches;
  }

  private kenBurnsAllowed(): boolean {
    return !this.reduceMotion && !this.saveGpu;
  }

  private loadBackdropAspect(url: string | undefined): void {
    const token = ++this.backdropAspectToken;
    this.backdropAspect.set(undefined);
    this.backdropKenBurns.set(false);
    if (!url || !isPlatformBrowser(this.platformId)) {
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    const apply = () => {
      if (token !== this.backdropAspectToken) {
        return;
      }
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        this.backdropAspect.set(img.naturalWidth / img.naturalHeight);
      }
      this.backdropKenBurns.set(this.kenBurnsAllowed());
    };
    img.onload = apply;
    img.onerror = () => {
      if (token === this.backdropAspectToken) {
        this.backdropAspect.set(undefined);
        this.backdropKenBurns.set(this.kenBurnsAllowed());
      }
    };
    img.src = url;
    if (img.complete) {
      apply();
    }
  }

  private populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({ params, queryParams })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params } = res;
      this.podcastName.set(params["podcastName"] ?? params["slug"] ?? "");
      this.siteService.setQuery(null);
      // Podcast-scoped search only on /podcast/ routes. News / TV pages (`slug`) use normal site search.
      this.siteService.setPodcast(params["podcastName"] ? this.podcastName() : null);
      this.siteService.setSubject(null);
    });
  }

  private loadMoreFromShow(episode: SearchResult, podcastName: string, field: "seriesName" | "podcastName"): void {
    const nameFilter = field === "seriesName" ? seriesNameEquals(podcastName) : podcastNameEquals(podcastName);
    const kind = this.moreFromKindFilter();
    const kindFilter = kind ? `${contentKindEquals(kind)} and ` : "";
    this.oDataService.getEntities<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: `${kindFilter}${nameFilter} and id ne '${episode.id}'`,
        searchMode: 'any',
        queryType: 'simple',
        count: false,
        skip: 0,
        top: RELATED_RAIL_SIZE,
        facets: [],
        orderby: "release desc"
      }
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => this.morePodcastEpisodes.set(
        data.entities
          .filter((e) => e.id !== episode.id)
          .map((hit) => normalizePlayableHit(hit))
      ),
      error: (error) => {
        if (field === "seriesName" && isUnknownSearchFieldError(error)) {
          this.loadMoreFromShow(episode, podcastName, "podcastName");
          return;
        }
        this.morePodcastEpisodes.set([]);
      }
    });
  }

  private loadRelated(episode: SearchResult, podcastName: string): void {
    this.relatedLoading.set(true);
    this.morePodcastEpisodes.set([]);
    this.subjectRails.set([]);

    const escape = (value: string) => value.replaceAll("'", "''");
    if (this.includeParentRail()) {
      this.loadMoreFromShow(episode, podcastName, "seriesName");
    }

    const subjects = this.visibleSubjects().slice(0, MAX_SUBJECT_RAILS);
    if (subjects.length === 0) {
      this.relatedLoading.set(false);
      return;
    }

    const found: SubjectRail[] = [];
    let remaining = subjects.length;
    subjects.forEach((subject) => {
      this.oDataService.getEntities<SearchResult>(
        new URL("/search", environment.api).toString(),
        {
          search: "",
          filter: `subjects/any(s: s eq '${escape(subject)}') and id ne '${episode.id}'`,
          searchMode: 'any',
          queryType: 'simple',
          count: false,
          skip: 0,
          top: RELATED_RAIL_SIZE,
          facets: [],
          orderby: "release desc"
        }
      ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (data) => {
          const episodes = data.entities
            .filter((e) => e.id !== episode.id)
            .map((hit) => normalizePlayableHit(hit));
          if (episodes.length > 0) {
            found.push({ subject, episodes });
          }
        },
        error: () => { /* Skip this rail on failure — the rest can still render. */ },
        complete: () => {
          remaining--;
          if (remaining === 0) {
            const ordered = subjects
              .map((s) => found.find((r) => r.subject === s))
              .filter((r): r is SubjectRail => !!r);
            this.subjectRails.set(ordered);
            this.relatedLoading.set(false);
          }
        }
      });
    });
  }

  play(item?: SearchDisplayEpisode): void {
    const hit = item ?? this.playable();
    if (hit) {
      startEpisodePlayback(hit, (track) => this.playerService.play(track));
    }
  }

  protected readonly playingEpisodeId = computed(() => this.playerService.episode()?.id);

  edit(podcastName: string, episodeId: string) {
    if (this.emitCuratorEdit) {
      this.curatorEdit.emit(episodeId);
      return;
    }

    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
      data: { episodeId: episodeId, podcastIdentifier: podcastName },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
      if (result) {
        if (result.updated) {
          snackBarRef = this.snackBar.open("Episode updated", "Review", { duration: 10000 });
        } else if (result.noChange) {
          snackBarRef = this.snackBar.open("No change", "Review", { duration: 3000 });
        }
        if (snackBarRef) {
          snackBarRef.onAction().subscribe(() => {
            const episode = JSON.stringify([`${result.podcastId}/${episodeId}`]);
            this.router.navigate(["/episodes", episode])
          });
        }
      }
    });
  }

  post() {
    const hit = this.playable();
    const episodeId = hit.id;
    const dialogRef = this.dialog
      .open<PostEpisodeDialogComponent, { episodeId: string; contentKind?: string | null }, PostEpisodeDialogResponse>(PostEpisodeDialogComponent, {
        data: { episodeId, contentKind: hit.contentKind },
        disableClose: true,
        autoFocus: true
      });
    dialogRef.afterClosed().subscribe(async result => {
      if (!result || result.closed) {
        return;
      }
      this.snackBar.openFromComponent(EpisodePublishResponseSnackbarComponent,
        { duration: 10000, data: { postEpisodeDialogResponse: result, podcastId: result?.response?.podcastId, episodeId } });
    });
  }
}
