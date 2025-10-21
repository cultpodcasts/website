import { Component, inject, signal } from '@angular/core';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
import { SearchState } from '../search-state.interface';
import { ODataService } from '../odata.service'
import { environment } from './../../environments/environment';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatePipe } from '@angular/common';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { SearchResultsFacets } from '../search-results-facets.interface';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { FacetState } from '../facet-state.interface';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { EpisodeLinksComponent } from "../episode-links/episode-links.component";
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';

const sortParam: string = "sort";
const pageParam: string = "page";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-subject-api',
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
  templateUrl: './subject-api.component.html',
  styleUrl: './subject-api.component.sass'
})

export class SubjectApiComponent {
  searchState: SearchState = {
    query: "",
    page: 1,
    sort: sortParamDateDesc,
    filter: null
  }

  subjectName: string = "";
  count: number = 0;
  prevPage: number = 0;
  nextPage: number = 0;
  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;
  authRoles: string[] = [];
  podcasts: string[] = [];
  podcastFilter: string = "";
  isSignedIn: boolean = false;
  private route = inject(ActivatedRoute);
  facets: SearchResultsFacets = {};
  resultsHeading: string = "";
  isLoading: boolean = true;
  protected isSubsequentLoading = signal<boolean>(false);
  protected results = signal<SearchResult[]>([]);

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    protected auth: AuthServiceWrapper,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
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
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const navigation = this.router.currentNavigation();
      let initial = true;
      if (navigation) {
        const facetState = navigation.extras.state as FacetState;
        if (facetState) {
          initial = false;
          this.facets = facetState.searchResultsFacets;
          this.podcasts = facetState.podcasts!;
        }
      }
      const { params, queryParams } = res;
      this.subjectName = params["subjectName"];
      this.isLoading = true;
      this.searchState.query = this.searchState.query = params["query"] ?? "";
      this.siteService.setQuery(this.searchState.query);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(this.subjectName);
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
      this.searchState.filter = `subjects/any(s: s eq '${this.subjectName.replaceAll("'", "''")}')`;
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
          this.podcastFilter,
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: this.infiniteScrollStrategy.getSkip(this.searchState.page),
        top: this.infiniteScrollStrategy.getTake(this.searchState.page),
        facets: ["podcastName,count:1000,sort:count", "subjects,count:10,sort:count"],
        orderby: sort
      }).subscribe(
        {
          next: data => {
            if (data.entities.length && !this.results().length) {
              this.scrollDisplatcher.scrolled().subscribe(async () => {
                if (this.results().length < count &&
                  this.isScrolledToBottom() && !this.isSubsequentLoading()) {
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

  setSort(sort: string) {
    var url = `/subject/${this.subjectName}`;
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
    let url = `search/${this.subjectName}`;
    if (this.searchState.query) {
      url += ` ${this.searchState.query}`;
    }
    this.router.navigate([url]);
  }

  editSubject() {
    const dialogRef = this.dialog.open(EditSubjectDialogComponent, {
      data: { subjectName: this.subjectName },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Subject updated", "Ok", { duration: 10000 });
      } else if (result.conflict) {
        let snackBarRef = this.snackBar.open(`Subject conflicts with '${result.conflict}'`, "Edit", { duration: 10000 });
        snackBarRef.onAction().subscribe(() => {
          const dialogRef = this.dialog.open(EditSubjectDialogComponent, {
            data: { subjectName: result.conflict },
            disableClose: true,
            autoFocus: true
          });
        });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }

  podcastsChange($event: MatChipListboxChange) {
    const delimiter = '£';
    var items: { count: number, value: string }[] = $event.value;
    this.podcasts = items.map(x => x.value.replaceAll("'", "''"));
    if (this.podcasts.length == 0) {
      this.podcastFilter = "";
    } else {
      var podcastsNameList = this.podcasts.join(delimiter);
      this.podcastFilter = ` and search.in(podcastName, '${podcastsNameList}', '${delimiter}')`;
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
