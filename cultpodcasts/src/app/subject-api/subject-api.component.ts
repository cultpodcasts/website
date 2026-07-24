import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
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
import {
  ALL_LANGUAGES_VALUE,
  ENGLISH_LANGUAGE_VALUE,
  SubjectLanguageSelection,
  buildSubjectLangFilter,
  displayedLanguageOptions,
  englishFacetCount,
  languageLabel,
  selectionFromChipValues,
  shouldShowLanguageSelector
} from '../subject-language-filter';
import { SearchResultFacet } from '../search-result-facet.interface';
import { SearchDescriptionPipe } from '../search-description.pipe';

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
    SubjectsComponent,
    SearchDescriptionPipe
  ],
  templateUrl: './subject-api.component.html',
  styleUrl: './subject-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SubjectApiComponent {
  protected query = signal<string>("");
  protected sortOrder = signal<string>(sortParamDateDesc);
  private page: number = 1;
  private filter: string | null = null;

  protected subjectName = signal<string>("");
  protected count = signal<number>(0);
  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;
  protected auth = inject(AuthServiceWrapper);
  protected authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });
  protected podcasts = signal<string[]>([]);
  private podcastFilter: string = "";
  protected languageSelection = signal<SubjectLanguageSelection>({ mode: "english" });
  protected langFilter = computed(() => buildSubjectLangFilter(this.languageSelection()));
  protected selectedLanguageValues = signal<string[]>([ENGLISH_LANGUAGE_VALUE]);
  protected languageOptions = signal<SearchResultFacet[]>([]);
  protected englishLanguageCount = signal<number>(0);
  readonly englishLanguageValue = ENGLISH_LANGUAGE_VALUE;
  readonly allLanguagesValue = ALL_LANGUAGES_VALUE;
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  protected facets = signal<SearchResultsFacets>({});
  protected errorMessage = signal<string>("");
  protected isLoading = signal<boolean>(true);
  protected isSubsequentLoading = signal<boolean>(false);
  protected results = signal<SearchResult[]>([]);
  private scrollSubscribed = false;

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
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
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
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
          this.podcasts.set(facetState.podcasts!);
        }
      }
      const { params, queryParams } = res;
      this.subjectName.set(params["subjectName"]);
      this.isLoading.set(true);
      this.query.set(params["query"] ?? "");
      this.siteService.setQuery(this.query());
      this.siteService.setPodcast(null);
      this.siteService.setSubject(this.subjectName());
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
      this.filter = `subjects/any(s: s eq '${this.subjectName().replaceAll("'", "''")}')`;
      this.siteService.setFilter(this.filter);
      this.execSearch(initial, initial);
    });
  }

  execSearch(initial: boolean, subsequent: boolean) {
    var sort: string = "";
    if (this.sortOrder() == "date-asc") {
      sort = "release asc";
    } else if (this.sortOrder() == "date-desc") {
      sort = "release desc";
    }

    const baseFilter = this.filter + this.podcastFilter;
    const resultFilter = baseFilter + this.langFilter();
    // Facets must omit the language filter so Azure returns non-null lang buckets.
    const facetFilter = subsequent ? baseFilter : resultFilter;
    const runResults = (facetsFromResponse?: SearchResultsFacets, facetCount?: number) => {
      this.oDataService.getEntitiesWithFacets<SearchResult>(
        new URL("/search", environment.api).toString(),
        {
          search: this.query(),
          filter: resultFilter,
          searchMode: 'any',
          queryType: 'simple',
          count: true,
          skip: this.infiniteScrollStrategy.getSkip(this.page),
          top: this.infiniteScrollStrategy.getTake(this.page),
          facets: subsequent
            ? []
            : ["podcastName,count:1000,sort:count", "subjects,count:10,sort:count"],
          orderby: sort
        }).subscribe(
          {
            next: data => {
              const count = data.metadata.get("count");
              this.count.set(count);
              if (!this.scrollSubscribed && data.entities.length && !this.results().length) {
                this.scrollSubscribed = true;
                this.scrollDispatcher.scrolled().pipe(
                  takeUntilDestroyed(this.destroyRef)
                ).subscribe(async () => {
                  if (this.results().length < count &&
                    this.isScrolledToBottom() && !this.isSubsequentLoading()) {
                    this.isSubsequentLoading.set(true);
                    this.page++;
                    this.execSearch(false, false);
                  }
                });
              }
              if (initial) {
                this.results.set(data.entities);
              } else {
                this.results.update(v => v.concat(data.entities));
              }
              this.isSubsequentLoading.set(false);
              if (subsequent && facetsFromResponse) {
                const newFacets: SearchResultsFacets = {
                  podcastName: facetsFromResponse.podcastName,
                  subjects: facetsFromResponse.subjects?.filter(x => !x.value.startsWith("_")),
                  lang: facetsFromResponse.lang
                };
                this.facets.set(newFacets);
                this.languageOptions.set(newFacets.lang ?? []);
                const subjectScopedTotal = facetCount ?? count;
                this.englishLanguageCount.set(englishFacetCount(subjectScopedTotal, this.languageOptions()));
              }
              this.isLoading.set(false);
            },
            error: (e) => {
              console.error(e);
              this.errorMessage.set("Something went wrong. Please try again.");
              this.isLoading.set(false);
            }
          });
    };

    if (subsequent) {
      this.oDataService.getEntitiesWithFacets<SearchResult>(
        new URL("/search", environment.api).toString(),
        {
          search: this.query(),
          filter: facetFilter,
          searchMode: 'any',
          queryType: 'simple',
          count: true,
          skip: 0,
          top: 0,
          facets: [
            "podcastName,count:1000,sort:count",
            "subjects,count:10,sort:count",
            "lang,count:50,sort:count"
          ],
          orderby: sort
        }).subscribe({
          next: facetData => runResults(facetData.facets, facetData.metadata.get("count")),
          error: (e) => {
            console.error(e);
            this.errorMessage.set("Something went wrong. Please try again.");
            this.isLoading.set(false);
          }
        });
      return;
    }

    runResults();
  }

  setSort(sort: string) {
    var url = `/subject/${this.subjectName()}`;
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
    let url = `search/${this.subjectName()}`;
    if (this.query()) {
      url += ` ${this.query()}`;
    }
    this.router.navigate([url]);
  }

  editSubject() {
    const dialogRef = this.dialog.open(EditSubjectDialogComponent, {
      data: { subjectName: this.subjectName() },
      disableClose: true,
      autoFocus: true,
      width: '90%'
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
            autoFocus: true,
            width: '90%'
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
    const podcasts = items.map(x => x.value.replaceAll("'", "''"));
    this.podcasts.set(podcasts);
    if (podcasts.length == 0) {
      this.podcastFilter = "";
    } else {
      var podcastsNameList = podcasts.join(delimiter);
      this.podcastFilter = ` and search.in(podcastName, '${podcastsNameList}', '${delimiter}')`;
    }
    this.page = 1;
    this.execSearch(true, false);
    this.refreshLanguageFacets();
  }

  /**
   * Re-fetch lang facets for the current subject (+ selected podcasts).
   * Podcast chips stay subject-wide; language chips/counts must match the active podcast filter.
   */
  private refreshLanguageFacets(): void {
    if (!this.filter) {
      return;
    }
    this.oDataService.getEntitiesWithFacets<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.query(),
        filter: this.filter + this.podcastFilter,
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: 0,
        top: 0,
        facets: ["lang,count:50,sort:count"],
        orderby: "release desc"
      }
    ).subscribe({
      next: facetData => {
        const langFacets = facetData.facets.lang ?? [];
        this.languageOptions.set(langFacets);
        this.facets.update(current => ({ ...current, lang: langFacets }));
        const scopedTotal = facetData.metadata.get("count") ?? 0;
        this.englishLanguageCount.set(englishFacetCount(scopedTotal, langFacets));
      },
      error: e => console.error(e)
    });
  }

  languagesChange($event: MatChipListboxChange) {
    const values: string[] = ($event.value as Array<string | { value: string }>)
      .map(item => typeof item === "string" ? item : item.value);
    let selected: string[];
    if (values.includes(ALL_LANGUAGES_VALUE) && values.length > 1) {
      selected = [ALL_LANGUAGES_VALUE];
    } else {
      selected = values;
    }
    this.selectedLanguageValues.set(selected);
    this.languageSelection.set(selectionFromChipValues(selected));
    this.page = 1;
    this.execSearch(true, false);
  }

  languageDisplayName(code: string): string {
    return languageLabel(code);
  }

  protected showLanguageSelector = computed(() =>
    shouldShowLanguageSelector(this.languageOptions(), this.languageSelection()));

  protected visibleLanguageOptions = computed(() =>
    displayedLanguageOptions(this.languageOptions(), this.languageSelection()));

  isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.page);
    return scrollPosition >= threshold;
  }
}
