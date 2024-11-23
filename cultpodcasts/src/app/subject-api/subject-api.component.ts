import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';
import { ISearchState } from '../ISearchState';
import { ODataService } from '../OdataService'
import { environment } from './../../environments/environment';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgIf, NgClass, NgFor, DatePipe, formatDate } from '@angular/common';
import { GuidService } from '../guid.service';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { SearchResultsFacets } from '../search-results-facets';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { FacetState } from '../facet-state';

const pageSize: number = 20;
const sortParam: string = "sort";
const pageParam: string = "page";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-subject-api',
  imports: [
    NgIf,
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgClass,
    NgFor,
    MatCardModule,
    RouterLink,
    DatePipe,
    MatExpansionModule,
    MatChipListbox,
    MatChipOption
  ],
  templateUrl: './subject-api.component.html',
  styleUrl: './subject-api.component.sass'
})
export class SubjectApiComponent {
  searchState: ISearchState = {
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

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private guidService: GuidService,
    protected auth: AuthServiceWrapper,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
  }

  private route = inject(ActivatedRoute);

  results: ISearchResult[] = [];
  facets: SearchResultsFacets = {};
  resultsHeading: string = "";
  isLoading: boolean = true;
  showPagingPrevious: boolean = false;
  showPagingNext: boolean = false;

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
      const navigation = this.router.getCurrentNavigation();
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

    let currentTime = Date.now();
    this.oDataService.getEntitiesWithFacets<ISearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.searchState.query,
        filter:
          this.searchState.filter +
          this.podcastFilter,
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: (this.searchState.page - 1) * pageSize,
        top: pageSize,
        facets: ["podcastName,count:1000,sort:count", "subjects,count:10,sort:count"],
        orderby: sort
      }).subscribe(
        {
          next: data => {
            this.results = data.entities;
            if (initial) {
              this.facets = {
                podcastName: data.facets.podcastName,
                subjects: data.facets.subjects?.filter(x => !x.value.startsWith("_"))
              };
            }
            var requestTime = (Date.now() - currentTime) / 1000;
            const count = data.metadata.get("count");
            this.count = count;
            this.isLoading = false;
            this.showPagingPrevious = this.searchState.page != undefined && this.searchState.page > 1;
            this.showPagingNext = (this.searchState.page * pageSize) < count;
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

  setPage(page: number) {
    var url = `/subject/${this.subjectName}`;
    if (this.searchState.query && this.searchState.query != "") {
      url += "/" + this.searchState.query;
    }
    this.searchState.page += page;
    var params: Params = {};
    if (this.searchState.page != null && this.searchState.page > 1) {
      params["page"] = this.searchState.page;
    }
    if (this.searchState.query) {
      if (this.searchState.sort != sortParamRank) {
        params[sortParam] = this.searchState.sort;
      }
    } else {
      if (this.searchState.sort != sortParamDateDesc) {
        params[sortParam] = this.searchState.sort;
      }
    }
    const facetState: FacetState = {
      searchResultsFacets: this.facets,
      podcasts: this.podcasts
    };
    this.router.navigate([url], { queryParams: params, state: facetState });
  }

  search() {
    let url = `search/${this.subjectName}`;
    if (this.searchState.query) {
      url += ` ${this.searchState.query}`;
    }
    this.router.navigate([url]);
  }

  share(item: ISearchResult) {
    let description = `"${item.episodeTitle}" - ${item.podcastName}`;
    description = description + ", " + formatDate(item.release, 'mediumDate', 'en-US');
    description = description + " [" + item.duration.split(".")[0].substring(1) + "]";
    const shortGuid = this.guidService.toBase64(item.id);
    const share = {
      title: item.episodeTitle,
      text: description,
      url: `${environment.shortner}/${shortGuid}`
    };
    window.navigator.share(share);
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
    if (this.searchState.page > 1) {
      this.setPage(1 - this.searchState.page);
    }
    else {
      this.execSearch(false);
    }
  }
}
