import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
import { ODataService } from '../odata.service'
import { environment } from './../../environments/environment';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { SearchResultsFacets } from '../search-results-facets.interface';
import { FacetState } from '../facet-state.interface';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import {
  ALL_LANGUAGES_VALUE,
  ENGLISH_LANGUAGE_VALUE,
  SubjectLanguageSelection,
  availableLanguageChipValues,
  buildSubjectLangFilter,
  displayedLanguageOptions,
  englishFacetCount,
  languageLabel,
  reconcileLanguageChipsForPodcasts,
  selectionFromChipValues,
  shouldShowLanguageSelector
} from '../subject-language-filter';
import { SearchResultFacet } from '../search-result-facet.interface';
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { SearchDisplayEpisode } from '../search-result-links';
import { canPlayEpisode } from '../episode-embed';
import { displayCatalogName } from '../display-catalog-name';
import { PlayerService } from '../player.service';

const sortParam: string = "sort";
const pageParam: string = "page";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-subject-api',
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    EpisodePosterComponent,
    SiteLoadingComponent,
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
  protected readonly playerService = inject(PlayerService);
  protected readonly displayCatalogName = displayCatalogName;
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

  clearPodcasts(): void {
    if (this.podcasts().length === 0) {
      return;
    }
    this.podcasts.set([]);
    this.podcastFilter = '';
    this.page = 1;
    this.refreshLanguageFacets({ reconcileSelection: true, thenSearch: true });
  }

  togglePodcast(value: string): void {
    const current = this.podcasts();
    const next = current.includes(value)
      ? current.filter((p) => p !== value)
      : [...current, value];
    this.podcasts.set(next);
    this.podcastFilter = next.length === 0
      ? ''
      : ` and search.in(podcastName, '${next.map((p) => p.replaceAll("'", "''")).join('£')}', '£')`;
    this.page = 1;
    this.refreshLanguageFacets({ reconcileSelection: true, thenSearch: true });
  }

  clearAllFilters(): void {
    this.podcasts.set([]);
    this.podcastFilter = '';
    this.setLanguageSelection([ALL_LANGUAGES_VALUE]);
    this.page = 1;
    this.refreshLanguageFacets({ reconcileSelection: false, thenSearch: true });
  }

  /**
   * Re-fetch lang facets for the current subject (+ selected shows).
   * Podcast chips stay subject-wide; language chips shrink to the active show filter.
   * When the active language filter would exclude all episodes for the selected shows,
   * widen language to All so later show picks are not stuck on a narrow code.
   */
  private refreshLanguageFacets(options?: {
    reconcileSelection?: boolean;
    thenSearch?: boolean;
  }): void {
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

        if (options?.reconcileSelection) {
          const nextChips = reconcileLanguageChipsForPodcasts(
            this.languageSelection(),
            availableLanguageChipValues(scopedTotal, langFacets)
          );
          if (nextChips) {
            this.setLanguageSelection(nextChips);
          }
        }

        if (options?.thenSearch) {
          this.execSearch(true, false);
        }
      },
      error: e => {
        console.error(e);
        if (options?.thenSearch) {
          this.execSearch(true, false);
        }
      }
    });
  }

  selectLanguage(value: string): void {
    this.applyLanguageSelection([value]);
  }

  toggleLanguage(value: string): void {
    let selected = this.selectedLanguageValues().filter(
      (v) => v !== ALL_LANGUAGES_VALUE
    );
    if (selected.includes(value)) {
      selected = selected.filter((v) => v !== value);
    } else {
      selected = [...selected, value];
    }
    if (selected.length === 0) {
      selected = [ALL_LANGUAGES_VALUE];
    }
    this.applyLanguageSelection(selected);
  }

  private setLanguageSelection(selected: string[]): void {
    this.selectedLanguageValues.set(selected);
    this.languageSelection.set(selectionFromChipValues(selected));
  }

  private applyLanguageSelection(selected: string[]): void {
    this.setLanguageSelection(selected);
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

  playEpisode(episode: SearchDisplayEpisode): void {
    if (!canPlayEpisode(episode)) {
      return;
    }
    this.playerService.play(episode);
  }

  isPlayingId(id: string): boolean {
    return this.playerService.episode()?.id === id;
  }
}
