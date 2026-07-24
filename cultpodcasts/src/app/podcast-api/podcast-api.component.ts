import { ChangeDetectionStrategy, Component, computed, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
import { ODataService } from '../odata.service';
import { environment } from './../../environments/environment';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { PodcastIndexComponent } from '../podcast-index/podcast-index.component';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { ShareMode } from '../share-mode.enum';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { SubmitDialogResponse } from '../submit-dialog-response.interface';
import { Share } from '../share.interface';
import { RenamePodcastDialogComponent } from '../rename-podcast-dialog/rename-podcast-dialog.component';
import { SearchResultsFacets } from '../search-results-facets.interface';
import { FacetState } from '../facet-state.interface';
import { SubmitUrlOriginResponseSnackbarComponent } from '../submit-url-origin-response-snackbar/submit-url-origin-response-snackbar.component';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { RenamePodcastDialogResponse } from "../rename-podcast-dialog-response.interface";
import { SearchIndexerState } from '../search-indexer-state.interface';
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { EpisodePlayerComponent } from '../episode-player/episode-player.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { SearchDisplayEpisode } from '../search-result-links';
import { canPlayEpisode } from '../episode-embed';
import { displayCatalogName } from '../display-catalog-name';

const sortParam: string = "sort";
const pageParam: string = "page";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-podcast-api',
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    EpisodePosterComponent,
    EpisodePlayerComponent,
    SiteLoadingComponent,
  ],
  templateUrl: './podcast-api.component.html',
  styleUrl: './podcast-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class PodcastApiComponent {
  protected query = signal<string>("");
  protected sortOrder = signal<string>(sortParamDateDesc);
  private page: number = 1;
  private filter: string | null = null;

  protected podcastName = signal<string>("");
  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;
  protected results = signal<SearchResult[]>([]);
  protected count = signal<number>(0);
  protected errorMessage = signal<string>("");
  protected isLoading = signal<boolean>(true);
  protected facets = signal<SearchResultsFacets>({});
  protected playingEpisode = signal<SearchDisplayEpisode | undefined>(undefined);
  protected readonly displayCatalogName = displayCatalogName;
  protected subjects = signal<string[]>([]);
  private subjectsFilter: string = "";
  protected isSubsequentLoading = signal<boolean>(false);
  private scrollSubscribed = false;
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthServiceWrapper);
  protected authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private scrollDispatcher: ScrollDispatcher,
    private infiniteScrollStrategy: InfiniteScrollStrategy
  ) {
  }

  ngOnInit() {
    this.populatePage();
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({ params, queryParams })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const navigation = this.router.currentNavigation();
      let initial = true;
      if (navigation) {
        const facetState = navigation.extras.state as FacetState;
        if (facetState) {
          initial = false;
          this.facets.set(facetState.searchResultsFacets);
          this.subjects.set(facetState.subjects!);
        }
      }
      const { params, queryParams } = res;
      this.podcastName.set(params["podcastName"]);
      let query = params["query"] ?? "";
      this.isLoading.set(true);
      this.query.set(query);
      this.siteService.setQuery(this.query());
      this.siteService.setPodcast(this.podcastName());
      this.siteService.setSubject(null);
      if (queryParams[pageParam]) {
        this.page = parseInt(queryParams[pageParam]);
      } else {
        this.page = 1;
      }
      if (queryParams[sortParam]) {
        this.sortOrder.set(queryParams[sortParam]);
      } else {
        if (this.query()) {
          this.sortOrder.set(sortParamRank);
        } else {
          this.sortOrder.set(sortParamDateDesc);
        }
      }
      this.filter = `(podcastName eq '${this.podcastName().replaceAll("'", "''")}')`;
      this.siteService.setFilter(this.filter);
      this.execSearch(initial, initial);
    });
  }

  execSearch(reset: boolean, subsequent: boolean) {
    var sort: string = "";
    if (this.sortOrder() == "date-asc") {
      sort = "release asc";
    } else if (this.sortOrder() == "date-desc") {
      sort = "release desc";
    }
    this.oDataService.getEntitiesWithFacets<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.query(),
        filter:
          this.filter +
          this.subjectsFilter,
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: this.infiniteScrollStrategy.getSkip(this.page),
        top: this.infiniteScrollStrategy.getTake(this.page),
        facets: ["subjects,count:1000,sort:count"],
        orderby: sort
      }).subscribe({
        next: data => {
          const count = data.metadata.get("count");
          this.count.set(count);
          if (!this.scrollSubscribed && data.entities.length && !this.results().length) {
            this.scrollSubscribed = true;
            this.scrollDispatcher.scrolled().pipe(
              takeUntilDestroyed(this.destroyRef)
            ).subscribe(async () => {
              if (this.results().length < count &&
                this.isScrolledToBottom() &&
                !this.isSubsequentLoading()) {
                this.isSubsequentLoading.set(true);
                this.page++;
                this.execSearch(false, false);
              }
            });
          }
          if (reset) {
            this.results.set(data.entities);
          } else {
            this.results.update(v => v.concat(data.entities));
          }
          this.isSubsequentLoading.set(false);
          if (subsequent) {
            this.facets.set({
              podcastName: data.facets.podcastName,
              subjects: data.facets.subjects?.filter(x => !x.value.startsWith("_"))
            });
          }
          this.isLoading.set(false);
        },
        error: (e) => {
          console.error(e);
          this.errorMessage.set("Something went wrong. Please try again.");
          this.isLoading.set(false);
        }
      });
  }

  edit(episodeId: string) {
    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
      data: { podcastIdentifier: this.podcastName(), episodeId: episodeId },
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

  editPodcast() {
    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName: this.podcastName() },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        var message = "Podcast updated";
        if (result.response?.failureIndexingEpisodes) {
          message += ". Some episodes failed to index";
        }
        if (result.response?.failureDeletingFromIndex) {
          message += ". Some episodes failed to delete from index";
        }
        let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }

  setSort(sort: string) {
    var url = `/podcast/${this.podcastName()}`;
    var query = this.siteService.getSiteData().query;
    if (query && query != "") {
      url = `${url}/${query}`;
    }
    var params: Params = {};
    if (this.query()) {
      if (sort != sortParamRank) {
        params[sortParam] = sort;
      }
    } else {
      if (sort != sortParamDateDesc) {
        params[sortParam] = sort;
      }
    }
    this.router.navigate([url], { queryParams: params });
  }

  search() {
    let url = `search/${this.podcastName()}`;
    if (this.query()) {
      url += ` ${this.query()}`;
    }
    this.router.navigate([url]);
  }

  index() {
    const dialogRef = this.dialog.open(PodcastIndexComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.index(this.results()[0].podcastName);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let message = "Podcast Indexed";
        let action = "Ok";
        if (result.episodeIds && result.episodeIds.length > 0) {
          message += `. ${result.episodeIds.length} episode${result.episodeIds.length > 1 ? 's' : ''} updated`;
          action = "Review";
        }
        let snackBarRef = this.snackBar.open(message, action, { duration: 10000 });
        if (result.episodeIds && result.episodeIds.length > 0) {
          snackBarRef.onAction().subscribe(() => {
            const episodeId = JSON.stringify(result.episodeIds);
            this.router.navigate(["/episodes", episodeId])
          });
        }
      } else if (result.podcastNotAutoIndex) {
        let snackBarRef = this.snackBar.open("Podcast not indexable", "Ok", { duration: 10000 });
      } else if (result.podcastNotFound) {
        let snackBarRef = this.snackBar.open("Podcast not found", "Ok", { duration: 10000 });
      }
    });
  }

  submitUrlForPodcast() {
    this.dialog
      .open(SubmitPodcastComponent, { disableClose: true, autoFocus: true })
      .afterClosed()
      .subscribe(async result => {
        if (result?.url) {
          await this.sendPodcast({ url: result.url, podcastName: this.podcastName(), podcastId: undefined, shareMode: ShareMode.Text });
        }
      });
  }

  async sendPodcast(share: Share) {
    const dialog = this.dialog.open<SendPodcastComponent, any, SubmitDialogResponse>(SendPodcastComponent, { disableClose: true, autoFocus: true });
    dialog
      .afterClosed()
      .subscribe(result => {
        if (result && result.submitted) {
          if (result.originResponse?.success != null) {
            let snackBarRef = this.snackBar.openFromComponent(SubmitUrlOriginResponseSnackbarComponent, { duration: 10000, data: { existingPodcast: true, response: result.originResponse?.success } });
          } else {
            let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
          }
        }
      });
    await dialog.componentInstance.submit(share);
  }

  renamePodcast() {
    const dialogRef = this.dialog.open<RenamePodcastDialogComponent, any, RenamePodcastDialogResponse>(RenamePodcastDialogComponent, {
      data: { podcastName: this.podcastName() },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
      let indexStatusMessage: string = "Index state unknown.";
      const state = result?.searchIndexerState;
      if (state !== undefined) {
        if (state === SearchIndexerState.Executed) {
          indexStatusMessage = "Index updated.";
        } else if (state === SearchIndexerState.Failure) {
          indexStatusMessage = "Index update failed.";
        } else if (state === SearchIndexerState.TooManyRequests) {
          indexStatusMessage = "Index not updated (too many requests).";
        } else if (state === SearchIndexerState.AlreadyRunning) {
          indexStatusMessage = "Index not updated (indexer already running).";
        } else if (state === SearchIndexerState.EpisodeNotFound) {
          indexStatusMessage = "Index not updated (episode not found).";
        } else if (state === SearchIndexerState.EpisodeIdConflict) {
          indexStatusMessage = "Index not updated (episode ID conflict).";
        } else if (state === SearchIndexerState.NoDocuments) {
          indexStatusMessage = "Index not updated (no documents to index).";
        } else if (state === SearchIndexerState.Unknown) {
          indexStatusMessage = "Index not updated (unknown indexer state).";
        }
      }
      if (result?.updated) {
        snackBarRef = this.snackBar.open(`Podcast name changed to "${result.newPodcastName}". ${indexStatusMessage}`, "Review", { duration: 10000 });
      } else if (result?.noChange) {
        snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
      if (result?.updated && snackBarRef) {
        snackBarRef.onAction().subscribe(() => {
          this.router.navigate(["/podcast", result.newPodcastName])
        });
      }
    });
  }

  protected sortLabel = computed(() => {
    switch (this.sortOrder()) {
      case sortParamDateAsc:
        return 'Oldest first';
      case sortParamRank:
        return 'Suggestions';
      default:
        return 'Newest first';
    }
  });

  clearSubjects(): void {
    if (this.subjects().length === 0) {
      return;
    }
    this.subjects.set([]);
    this.subjectsFilter = '';
    this.page = 1;
    this.execSearch(true, false);
  }

  toggleSubject(value: string): void {
    const current = this.subjects();
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    this.subjects.set(next);
    this.subjectsFilter = next.length === 0
      ? ''
      : ` and subjects/any(s: search.in(s, '${next.map((s) => s.replaceAll("'", "''")).join('£')}', '£'))`;
    this.page = 1;
    this.execSearch(true, false);
  }

  isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.page);
    return scrollPosition >= threshold;
  }

  isSelected(o1: any, o2: any): boolean {
    return true;
  }

  playEpisode(episode: SearchDisplayEpisode): void {
    if (!canPlayEpisode(episode)) {
      return;
    }
    this.playingEpisode.set(episode);
  }

  closePlayer(): void {
    this.playingEpisode.set(undefined);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.playingEpisode()) {
      this.closePlayer();
    }
  }

}
