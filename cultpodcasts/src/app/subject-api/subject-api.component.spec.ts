import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Params, Router } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, NEVER, Observable, of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { SubjectApiComponent } from './subject-api.component';
import { ODataService } from '../odata.service';
import { SiteService } from '../site.service';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { PlayerService } from '../player.service';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { ALL_LANGUAGES_VALUE, ENGLISH_LANGUAGE_VALUE } from '../subject-language-filter';

interface SearchCall {
  filter?: string;
  facets?: string[];
  top?: number;
}

function unknownField(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 400, statusText: 'Bad Request', error: {} });
}

function serverError(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 500, statusText: 'Server Error', error: { message: 'timeout' } });
}

function searchPage() {
  return {
    metadata: new Map<string, number>([['count', 1]]),
    entities: [],
    facets: { podcastName: [], seriesName: [{ value: 'Show A', count: 1 }], subjects: [], lang: [] },
  };
}

describe('SubjectApiComponent', () => {
  let fixture: ComponentFixture<SubjectApiComponent>;
  let calls: SearchCall[];
  let respond: (request: SearchCall) => Observable<unknown>;
  let queryParams$: BehaviorSubject<Params>;
  let fragment$: BehaviorSubject<string | null>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    calls = [];
    respond = () => of(searchPage());
    queryParams$ = new BehaviorSubject<Params>({});
    fragment$ = new BehaviorSubject<string | null>(null);
    await TestBed.configureTestingModule({
      imports: [SubjectApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ subjectName: 'Topic' }), queryParams: queryParams$, fragment: fragment$ } },
        { provide: AuthServiceWrapper, useValue: { roles: of([]), isSignedIn: of(false) } },
        { provide: SiteService, useValue: { setQuery: () => undefined, setPodcast: () => undefined, setSubject: () => undefined, setFilter: () => undefined, getSiteData: () => ({ query: '' }) } },
        { provide: ODataService, useValue: { getEntitiesWithFacets: (_url: string, request: SearchCall) => { calls.push(request); return respond(request); } } },
        { provide: PlayerService, useValue: { episode: () => undefined, mode: () => 'dock', play: () => undefined, isQueuedId: () => false } },
        { provide: ScrollDispatcher, useValue: { scrolled: () => NEVER } },
        { provide: InfiniteScrollStrategy, useClass: InfiniteScrollStrategy },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubjectApiComponent);
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.inject(Router).navigate = navigate as unknown as Router['navigate'];
  });

  function textOf(request: SearchCall): string {
    return `${request.filter ?? ''} ${(request.facets ?? []).join(' ')}`;
  }

  it('retries the subject facet query once on the live field when seriesName is missing', () => {
    let missed = 0;
    respond = (request) => {
      if (textOf(request).includes('seriesName')) {
        missed++;
        return throwError(() => unknownField());
      }
      return of(searchPage());
    };

    fixture.detectChanges();

    expect(missed).toBe(1);
    expect(textOf(calls[0])).toContain('seriesName,count:1000');
    expect(textOf(calls[1])).toContain('podcastName,count:1000');
    expect(calls.some((call) => (call.facets ?? []).length === 0)).toBe(true);
  });

  it('rewrites the show filter and searches once when language facets fail on seriesName', () => {
    respond = (request) => {
      const facets = request.facets ?? [];
      const onlyLang = facets.length === 1 && facets[0].startsWith('lang');
      if (onlyLang && (request.filter ?? '').includes('seriesName')) {
        return throwError(() => unknownField());
      }
      return of(searchPage());
    };

    fixture.detectChanges();
    const beforeToggle = calls.length;
    fixture.componentInstance.togglePodcast('Show A');

    const retry = calls[calls.length - 1];
    expect(calls.length).toBe(beforeToggle + 2);
    expect(retry.filter).toContain("search.in(podcastName, 'Show A'");
    expect(retry.filter).not.toContain('seriesName');
    expect((retry.facets ?? []).join(' ')).toContain('podcastName');
  });

  it('does not latch the live field when language facets fail for another reason', () => {
    respond = (request) => {
      const facets = request.facets ?? [];
      const onlyLang = facets.length === 1 && facets[0].startsWith('lang');
      if (onlyLang && (request.filter ?? '').includes('seriesName')) {
        return throwError(() => serverError());
      }
      return of(searchPage());
    };

    fixture.detectChanges();
    fixture.componentInstance.togglePodcast('Show A');

    const followUp = calls[calls.length - 1];
    expect(followUp.filter).toContain("search.in(seriesName, 'Show A'");
    expect(calls.filter((call) => (call.filter ?? '').includes('podcastName'))).toEqual([]);
  });

  it('does not latch the live field when the facet query fails for another reason', () => {
    respond = () => throwError(() => serverError());

    fixture.detectChanges();

    expect(calls).toHaveLength(1);
    expect(textOf(calls[0])).toContain('seriesName');
    expect(fixture.nativeElement.textContent).toContain('Something went wrong');
  });

  describe('filters in the URL', () => {
    function languagePage() {
      return {
        metadata: new Map<string, number>([['count', 6]]),
        entities: [],
        facets: {
          seriesName: [{ value: 'Show A', count: 4 }, { value: 'Show B', count: 2 }],
          subjects: [],
          lang: [{ value: 'sw', count: 3 }, { value: 'ki', count: 2 }],
        },
      };
    }

    beforeEach(() => {
      respond = () => of(languagePage());
    });

    function resultFilter(): string {
      const results = calls.filter((call) => (call.top ?? 0) > 0);
      return results.at(-1)?.filter ?? '';
    }

    function lastFragment(): string | undefined {
      return navigate.mock.calls.at(-1)?.[1]?.fragment;
    }

    function activeLanguageChips(): string[] {
      const facet = (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Filter by language"]');
      return [...(facet?.querySelectorAll('.browse-pill.is-active') ?? [])].map((chip) => chip.textContent!.trim());
    }

    it('loads the English default with no fragment', () => {
      fixture.detectChanges();

      expect(resultFilter()).toContain("(lang eq null or lang eq 'en')");
      expect(navigate).not.toHaveBeenCalled();
    });

    it('starts from just the clicked language on the first click', () => {
      fixture.detectChanges();
      expect(activeLanguageChips()).toEqual(['English']);
      fixture.componentInstance.toggleLanguage('sw');
      fixture.detectChanges();

      expect(resultFilter()).toContain("lang eq 'sw'");
      expect(resultFilter()).not.toContain('lang eq null');
      expect(lastFragment()).toBe('lang=sw');
      expect(navigate.mock.calls.at(-1)?.[0]).toEqual([]);
      // A user's filter change is its own history entry (Back returns to it).
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({ queryParamsHandling: 'preserve', replaceUrl: false, scroll: 'manual' });
      // One active chip, and not English (label text is owned by languageLabel).
      expect(activeLanguageChips()).toHaveLength(1);
      expect(activeLanguageChips()).not.toContain('English');
    });

    it('adds and removes languages after the first click, falling back to All', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.toggleLanguage('sw');
      component.toggleLanguage('ki');

      expect(resultFilter()).toContain("search.in(lang, 'sw,ki', ',')");
      expect(lastFragment()).toBe('lang=sw,ki');

      component.toggleLanguage('sw');
      expect(resultFilter()).toContain("lang eq 'ki'");
      expect(lastFragment()).toBe('lang=ki');

      component.toggleLanguage('ki');
      expect(resultFilter()).not.toContain('lang');
      expect(lastFragment()).toBe('lang=all');
    });

    it('keeps English only when English is clicked first, then adds', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.toggleLanguage(ENGLISH_LANGUAGE_VALUE);

      expect(resultFilter()).toContain("(lang eq null or lang eq 'en')");
      expect(navigate).not.toHaveBeenCalled();

      component.toggleLanguage('sw');
      expect(resultFilter()).toContain("search.in(lang, 'sw', ',')");
      expect(resultFilter()).toContain('lang eq null');
      expect(lastFragment()).toBe('lang=en,sw');
    });

    it('clears to every show and language, then starts afresh on the next language click', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.togglePodcast('Show A');
      component.toggleLanguage('sw');
      expect(lastFragment()).toBe('show=Show A&lang=sw');

      component.clearAllFilters();
      expect(lastFragment()).toBe('lang=all');
      expect(resultFilter()).not.toContain('Show A');
      expect(resultFilter()).not.toContain('lang');

      component.toggleLanguage('ki');
      expect(resultFilter()).toContain("lang eq 'ki'");
      expect(lastFragment()).toBe('lang=ki');
    });

    it('restores languages and shows from a bookmarked fragment and toggles from there', () => {
      fragment$.next('lang=sw,ki&show=Show A');
      fixture.detectChanges();

      expect(resultFilter()).toContain("search.in(seriesName, 'Show A'");
      expect(resultFilter()).toContain("search.in(lang, 'sw,ki', ',')");
      expect(navigate).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Show B');

      fixture.componentInstance.toggleLanguage('ki');
      expect(resultFilter()).toContain("lang eq 'sw'");
      expect(lastFragment()).toBe('show=Show A&lang=sw');
    });

    it('ignores unknown shows and malformed languages in the fragment and tidies it', () => {
      queryParams$.next({ sort: 'date-asc' });
      fragment$.next('lang=<b>&show=Show A&show=Missing show');
      fixture.detectChanges();

      expect(resultFilter()).toContain("search.in(seriesName, 'Show A'");
      expect(resultFilter()).not.toContain('Missing show');
      expect(resultFilter()).toContain("(lang eq null or lang eq 'en')");
      expect(lastFragment()).toBe('show=Show A');
      // Tidying the URL replaces: no history entry of its own.
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({ queryParamsHandling: 'preserve', replaceUrl: true });

      // Malformed lang means untouched: the first click still starts afresh.
      fixture.componentInstance.toggleLanguage('sw');
      expect(resultFilter()).toContain("lang eq 'sw'");
    });

    it('drops restored languages the subject does not offer and tidies the fragment', () => {
      fragment$.next('lang=sw,zz');
      fixture.detectChanges();

      expect(resultFilter()).toContain("lang eq 'sw'");
      expect(resultFilter()).not.toContain('zz');
      expect(lastFragment()).toBe('lang=sw');
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0][1]).toMatchObject({ replaceUrl: true });
    });

    it('widens to All and says so in the fragment when no restored language is offered', () => {
      fragment$.next('lang=zz');
      fixture.detectChanges();

      expect(resultFilter()).not.toContain('lang');
      expect(lastFragment()).toBe('lang=all');
    });

    it('updates the fragment when a show change widens the language selection to All', () => {
      respond = (request) => (request.filter ?? '').includes('Show A') && (request.top ?? 0) === 0
        ? of({ ...languagePage(), metadata: new Map<string, number>([['count', 3]]), facets: { ...languagePage().facets, lang: [{ value: 'sw', count: 3 }] } })
        : of(languagePage());
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.toggleLanguage('ki');
      expect(lastFragment()).toBe('lang=ki');

      component.togglePodcast('Show A');

      expect(resultFilter()).not.toContain("lang eq 'ki'");
      expect(lastFragment()).toBe('show=Show A&lang=all');
    });

    it('pushes the user change, then replaces it when a show change widens the language to All', () => {
      respond = (request) => (request.filter ?? '').includes('Show A') && (request.top ?? 0) === 0
        ? of({ ...languagePage(), metadata: new Map<string, number>([['count', 3]]), facets: { ...languagePage().facets, lang: [{ value: 'sw', count: 3 }] } })
        : of(languagePage());
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.toggleLanguage('ki');
      navigate.mockClear();

      component.togglePodcast('Show A');

      expect(navigate.mock.calls.map(([, extras]) => [extras.fragment, extras.replaceUrl])).toEqual([
        ['show=Show A&lang=ki', false],
        ['show=Show A&lang=all', true],
      ]);
    });

    it('pushes no history entry when a filter action leaves the state unchanged', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.clearAllFilters();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0][1]).toMatchObject({ fragment: 'lang=all', replaceUrl: false });

      component.clearAllFilters();
      component.selectLanguage(ALL_LANGUAGES_VALUE);
      component.clearPodcasts();

      expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('restores each earlier selection on Back and the later one on Forward', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.toggleLanguage('sw');
      component.toggleLanguage('ki');
      expect(lastFragment()).toBe('lang=sw,ki');
      navigate.mockClear();

      // Back: the router emits the previous entry's fragment.
      fragment$.next('lang=sw');
      fixture.detectChanges();
      expect(resultFilter()).toContain("lang eq 'sw'");
      expect(resultFilter()).not.toContain('ki');
      expect(activeLanguageChips()).toHaveLength(1);

      // Back to the first entry: the untouched English default.
      fragment$.next(null);
      fixture.detectChanges();
      expect(resultFilter()).toContain("(lang eq null or lang eq 'en')");
      expect(activeLanguageChips()).toEqual(['English']);

      // Forward again.
      fragment$.next('lang=sw');
      fixture.detectChanges();
      expect(resultFilter()).toContain("lang eq 'sw'");

      // Restoring never writes history of its own.
      expect(navigate).not.toHaveBeenCalled();
    });

    it('treats the restored default as untouched, so the next click starts afresh', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.toggleLanguage('sw');
      fragment$.next(null);

      component.toggleLanguage('ki');

      expect(resultFilter()).toContain("lang eq 'ki'");
      expect(resultFilter()).not.toContain('lang eq null');
      expect(lastFragment()).toBe('lang=ki');
    });

    it('restores shows on Back and clears them on Forward to a selection without shows', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.togglePodcast('Show A');
      expect(lastFragment()).toBe('show=Show A');

      fragment$.next(null);
      expect(resultFilter()).not.toContain('Show A');

      fragment$.next('show=Show A');
      expect(resultFilter()).toContain("search.in(seriesName, 'Show A'");
    });

    it('does not reload when the router echoes the URL the page wrote', () => {
      fixture.detectChanges();
      fixture.componentInstance.toggleLanguage('sw');
      const before = calls.length;

      fragment$.next('lang=sw');

      expect(calls.length).toBe(before);
    });

    it('reloads with restored filters when the fragment is edited or navigated', () => {
      fixture.detectChanges();
      fixture.componentInstance.toggleLanguage('sw');

      fragment$.next('lang=all');

      expect(resultFilter()).not.toContain('lang');
    });

    it('keeps the filters when the sort changes', () => {
      fixture.detectChanges();
      fixture.componentInstance.toggleLanguage('sw');
      fixture.componentInstance.setSort('date-asc');

      expect(navigate.mock.calls.at(-1)).toEqual([
        ['/subject/Topic'],
        { queryParams: { sort: 'date-asc' }, fragment: 'lang=sw' },
      ]);
    });

    it('removes the fragment when the filters return to the default', () => {
      fixture.detectChanges();
      fixture.componentInstance.togglePodcast('Show A');
      expect(lastFragment()).toBe('show=Show A');

      fixture.componentInstance.togglePodcast('Show A');
      expect(lastFragment()).toBeUndefined();
    });

    it('selects only All from the All chip and keeps it bookmarkable', () => {
      fixture.detectChanges();
      fixture.componentInstance.selectLanguage(ALL_LANGUAGES_VALUE);

      expect(resultFilter()).not.toContain('lang');
      expect(lastFragment()).toBe('lang=all');
    });
  });
});
