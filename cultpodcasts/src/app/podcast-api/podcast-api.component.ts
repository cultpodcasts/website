import { Component, inject, signal } from '@angular/core';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
import { SearchState } from '../search-state.interface';
import { ODataService } from '../odata.service';
import { environment } from './../../environments/environment';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatePipe } from '@angular/common';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { SearchResultsFacets } from '../search-results-facets.interface';
import { FacetState } from '../facet-state.interface';
import { SubmitUrlOriginResponseSnackbarComponent } from '../submit-url-origin-response-snackbar/submit-url-origin-response-snackbar.component';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { EpisodeLinksComponent } from "../episode-links/episode-links.component";
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';

const sortParam: string = "sort";
const pageParam: string = "page";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-podcast-api',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule,
    RouterLink,
    DatePipe,
    MatExpansionModule,
    MatChipListbox,
    MatChipOption,
    EpisodeImageComponent,
    EpisodeLinksComponent,
    BookmarkComponent,
    SubjectsComponent
  ],
  templateUrl: './podcast-api.component.html',
  styleUrl: './podcast-api.component.sass'
})

export class PodcastApiComponent {
  searchState: SearchState = {
    query: "",
    page: 1,
    sort: sortParamDateDesc,
    filter: null
  }

  podcastName: string = "";
  count: number = 0;
  prevPage: number = 0;
  nextPage: number = 0;
  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;
  protected results = signal<SearchResult[]>([]);
  resultsHeading: string = "";
  isLoading: boolean = true;
  authRoles: string[] = [];
  facets: SearchResultsFacets = {};
  subjects: string[] = [];
  subjectsFilter: string = "";
  isSignedIn: boolean = false;
  protected isSubsequentLoading = signal<boolean>(false);
  private route = inject(ActivatedRoute);

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    protected auth: AuthServiceWrapper,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private scrollDisplatcher: ScrollDispatcher,
    private infiniteScrollStrategy: InfiniteScrollStrategy
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
    this.auth.isSignedIn.subscribe(isSignedIn => this.isSignedIn = isSignedIn);
  }

  ngOnInit() {
    this.populatePage();
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({ params, queryParams })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const navigation = this.router.currentNavigation();
      let initial = true;
      if (navigation) {
        const facetState = navigation.extras.state as FacetState;
        if (facetState) {
          initial = false;
          this.facets = facetState.searchResultsFacets;
          this.subjects = facetState.subjects!;
        }
      }
      const { params, queryParams } = res;
      this.podcastName = params["podcastName"];
      let query = params["query"] ?? "";
      this.isLoading = true;
      this.searchState.query = query;
      this.siteService.setQuery(this.searchState.query);
      this.siteService.setPodcast(this.podcastName);
      this.siteService.setSubject(null);
      if (queryParams[pageParam]) {
        this.searchState.page = parseInt(queryParams[pageParam]);
        this.prevPage = this.searchState.page - 1;
        this.nextPage = this.searchState.page + 1;
      } else {
        this.nextPage = 2;
        this.searchState.page = 1;
      }
      if (queryParams[sortParam]) {
        this.searchState.sort = queryParams[sortParam];
      } else {
        if (this.searchState.query) {
          this.searchState.sort = sortParamRank;
        } else {
          this.searchState.sort = sortParamDateDesc;
        }
      }
      this.searchState.filter = `(podcastName eq '${this.podcastName.replaceAll("'", "''")}')`;
      this.siteService.setFilter(this.searchState.filter);
      this.execSearch(initial);
    });
  }

  execSearch(initial: boolean) {
    var sort: string = "";
    if (this.searchState.sort == "date-asc") {
      sort = "release asc";
    } else if (this.searchState.sort == "date-desc") {
      sort = "release desc";
    }
    this.oDataService.getEntitiesWithFacets<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.searchState.query,
        filter:
          this.searchState.filter +
          this.subjectsFilter,
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: this.infiniteScrollStrategy.getSkip(this.searchState.page),
        top: this.infiniteScrollStrategy.getTake(this.searchState.page),
        facets: ["subjects,count:1000,sort:count"],
        orderby: sort
      }).subscribe({
        next: data => {
          if (data.entities.length && !this.results().length) {
            this.scrollDisplatcher.scrolled().subscribe(async () => {
              if (this.results().length < count &&
                this.isScrolledToBottom() &&
                !this.isSubsequentLoading()) {
                this.isSubsequentLoading.set(true);
                this.searchState.page++;
                this.execSearch(false);
              }
            });
          }
          if (initial) {
            this.results.set(data.entities);
          } else {
            this.results.update(v => v.concat(data.entities));
          }
          this.isSubsequentLoading.set(false);
          if (initial) {
            this.facets = {
              podcastName: data.facets.podcastName,
              subjects: data.facets.subjects?.filter(x => !x.value.startsWith("_"))
            };
          }
          const count = data.metadata.get("count");
          this.count = count;
          this.isLoading = false;
        },
        error: (e) => {
          console.error(e);
          this.resultsHeading = "Something went wrong. Please try again.";
          this.isLoading = false;
        }
      });
  }

  edit(id: string) {
    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
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
            const episodeId = JSON.stringify([id]);
            this.router.navigate(["/episodes", episodeId])
          });
        }
      }
    });
  }

  editPodcast() {
    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName: this.podcastName },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Podcast updated", "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }

  setSort(sort: string) {
    var url = `/podcast/${this.podcastName}`;
    var query = this.siteService.getSiteData().query;
    if (query && query != "") {
      url = `${url}/${query}`;
    }
    var params: Params = {};
    if (this.searchState.query) {
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
    let url = `search/${this.podcastName}`;
    if (this.searchState.query) {
      url += ` ${this.searchState.query}`;
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
          await this.sendPodcast({ url: result.url, podcastName: this.podcastName, podcastId: undefined, shareMode: ShareMode.Text });
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
    const dialogRef = this.dialog.open(RenamePodcastDialogComponent, {
      data: { podcastName: this.podcastName },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
      const indexUpdated = result?.indexUpdated ? "" : " not";
      if (result.updated) {
        snackBarRef = this.snackBar.open(`Podcast name changed to "${result.newPodcastName}". Index ${indexUpdated} updated.`, "Review", { duration: 10000 });
      } else if (result.noChange) {
        snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
      if (result.updated && snackBarRef) {
        snackBarRef.onAction().subscribe(() => {
          this.router.navigate(["/podcast", result.newPodcastName])
        });
      }
    });
  }

  subjectsChange($event: MatChipListboxChange) {
    const delimiter = '£';
    var items: { count: number, value: string }[] = $event.value;
    this.subjects = items.map(x => x.value.replaceAll("'", "''"));
    if (this.subjects.length == 0) {
      this.subjectsFilter = "";
    } else {
      var subjectsameList = this.subjects.join(delimiter);
      this.subjectsFilter = ` and subjects/any(s: search.in(s, '${subjectsameList}', '${delimiter}'))`;
    }
    this.searchState.page = 1;
    this.execSearch(true);
  }

  isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.searchState.page);
    return scrollPosition >= threshold;
  }
}
