import { Component, DestroyRef, inject, Input, ChangeDetectionStrategy, signal, computed, effect } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SearchResult } from '../search-result.interface';
import { DatePipe } from '@angular/common';
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
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { SearchDescriptionPipe } from '../search-description.pipe';
import { displayCatalogName } from '../display-catalog-name';
import { SearchDisplayEpisode, episodeImageUrl } from '../search-result-links';
import { canPlayEpisode, playActionLabel } from '../episode-embed';
import { PlayerService } from '../player.service';

interface SubjectRail {
  subject: string;
  episodes: SearchResult[];
}

const RELATED_RAIL_SIZE = 12;
const MAX_SUBJECT_RAILS = 4;

@Component({
  selector: 'app-podcast-episode',
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    RouterLink,
    DatePipe,
    EpisodeLinksComponent,
    BookmarkComponent,
    EpisodePosterComponent,
    SiteLoadingComponent,
    SearchDescriptionPipe
  ],
  templateUrl: './podcast-episode.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './podcast-episode.component.sass'
})
export class PodcastEpisodeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthServiceWrapper);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly siteService = inject(SiteService);
  private readonly oDataService = inject(ODataService);
  protected readonly playerService = inject(PlayerService);

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

  private _episode = signal<SearchResult | undefined>(undefined);
  private _parentLoaded: boolean = false;

  podcastName = signal("");
  protected readonly displayCatalogName = displayCatalogName;
  protected readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected readonly isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });
  isLoading = signal(true);

  protected readonly playable = computed(() => {
    const ep = this._episode();
    return ep ? canPlayEpisode(ep) : false;
  });

  protected readonly playLabel = computed(() => {
    const ep = this._episode();
    return ep ? playActionLabel(ep) : 'Listen';
  });

  protected readonly queued = computed(() => this.playerService.isQueued(this._episode()));

  protected readonly duration = computed(() => {
    const ep = this._episode();
    if (!ep) {
      return '';
    }
    const cleaned = (ep.duration ?? '').split('.')[0];
    return cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
  });

  protected readonly backdropUrl = computed(() => {
    const ep = this._episode();
    return ep ? episodeImageUrl(ep)?.toString() : undefined;
  });

  protected readonly visibleSubjects = computed(() =>
    (this._episode()?.subjects ?? []).filter((s) => !s.startsWith('_'))
  );

  /** "More from this podcast" rail — other episodes from the same show. */
  protected readonly morePodcastEpisodes = signal<SearchResult[]>([]);
  /** "More on <subject>" rails — one per subject, in the episode's subject order. */
  protected readonly subjectRails = signal<SubjectRail[]>([]);
  protected readonly relatedLoading = signal<boolean>(false);

  private lastRelatedKey: string | undefined;

  constructor() {
    effect(() => {
      const ep = this._episode();
      const podcast = this.podcastName();
      if (!ep || !podcast) {
        return;
      }
      const key = `${podcast}::${ep.id}`;
      if (key === this.lastRelatedKey) {
        return;
      }
      this.lastRelatedKey = key;
      this.loadRelated(ep, podcast);
    });
  }

  async ngOnInit(): Promise<any> {
    this.populatePage();
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({ params, queryParams })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params } = res;
      this.podcastName.set(params["podcastName"]);
      this.siteService.setQuery(null);
      this.siteService.setPodcast(this.podcastName());
      this.siteService.setSubject(null);
    });
  }

  /** Fetches "more from this podcast" + one rail per subject, without blocking the hero. */
  private loadRelated(episode: SearchResult, podcastName: string): void {
    this.relatedLoading.set(true);
    this.morePodcastEpisodes.set([]);
    this.subjectRails.set([]);

    const escape = (value: string) => value.replaceAll("'", "''");

    this.oDataService.getEntities<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: `(podcastName eq '${escape(podcastName)}') and id ne '${episode.id}'`,
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
        data.entities.filter((e) => e.id !== episode.id)
      ),
      error: () => this.morePodcastEpisodes.set([])
    });

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
          const episodes = data.entities.filter((e) => e.id !== episode.id);
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

  playEpisode(episode?: SearchDisplayEpisode): void {
    const ep = episode ?? this._episode();
    if (ep && canPlayEpisode(ep)) {
      this.playerService.play(ep);
    }
  }

  toggleQueue(): void {
    const ep = this._episode();
    if (ep && canPlayEpisode(ep)) {
      this.playerService.toggleQueue(ep);
    }
  }

  isPlayingId(id: string): boolean {
    return this.playerService.episode()?.id === id;
  }

  edit(podcastName: string, episodeId: string) {
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

  podcastPage() {
    let url = `podcast/${this.podcastName()}`;
    this.router.navigate([url]);
  }

  post(podcastName: string, episodeId: string) {
    const dialogRef = this.dialog
      .open<PostEpisodeDialogComponent, any, PostEpisodeDialogResponse>(PostEpisodeDialogComponent, {
        data: { podcastIdentifier: podcastName, episodeId: episodeId },
        disableClose: true,
        autoFocus: true
      });
    dialogRef.afterClosed().subscribe(async result => {
      this.snackBar.openFromComponent(EpisodePublishResponseSnackbarComponent,
        { duration: 10000, data: { postEpisodeDialogResponse: result, podcastId: result?.response?.podcastId, episodeId: episodeId } });
    });
  }
}
