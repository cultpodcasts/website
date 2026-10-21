import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Params, Router } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { SearchApiComponent } from './search-api.component';
import { ODataService } from '../odata.service';
import { SiteService } from '../site.service';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { PlayerService } from '../player.service';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';

interface SearchCall {
  filter?: string;
  facets?: string[];
}

function unknownField(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 400, statusText: 'Bad Request', error: {} });
}

function namedField(property: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 400,
    statusText: 'Bad Request',
    error: { error: { message: `Could not find a property named '${property}' on type 'search.document'.` } },
  });
}

function serverError(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 500, statusText: 'Server Error', error: { message: 'timeout' } });
}

function searchPage(contentKind: { value: string; count: number }[] = []) {
  return {
    metadata: new Map<string, number>([['count', 0]]),
    entities: [],
    facets: { podcastName: [], seriesName: [], subjects: [], lang: [], contentKind },
  };
}

type ScriptStep = 'unknown' | 'series' | 'kind' | 'server' | 'ok';

describe('SearchApiComponent', () => {
  let fixture: ComponentFixture<SearchApiComponent>;
  let calls: SearchCall[];
  let script: ScriptStep[];
  let page = searchPage();
  let queryParams$: BehaviorSubject<Params>;
  let fragment$: BehaviorSubject<string | null>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    calls = [];
    queryParams$ = new BehaviorSubject<Params>({});
    fragment$ = new BehaviorSubject<string | null>(null);
    script = ['ok'];
    page = searchPage();
    await TestBed.configureTestingModule({
      imports: [SearchApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ query: 'hello' }), queryParams: queryParams$, fragment: fragment$ } },
        { provide: AuthServiceWrapper, useValue: { roles: of([]), isSignedIn: of(false) } },
        { provide: SiteService, useValue: { setQuery: () => undefined, setPodcast: () => undefined, setSubject: () => undefined, setFilter: () => undefined, getSiteData: () => ({ query: '' }) } },
        {
          provide: ODataService,
          useValue: {
            getEntitiesWithFacets: (_url: string, request: SearchCall) => {
              calls.push(request);
              const next = script.shift() ?? 'ok';
              if (next === 'unknown') {
                return throwError(() => unknownField());
              }
              if (next === 'series') {
                return throwError(() => namedField('seriesName'));
              }
              if (next === 'kind') {
                return throwError(() => namedField('contentKind'));
              }
              if (next === 'server') {
                return throwError(() => serverError());
              }
              return of(page);
            },
          },
        },
        { provide: PlayerService, useValue: { episode: () => undefined, mode: () => 'dock', play: () => undefined, isQueuedId: () => false } },
        { provide: ScrollDispatcher, useValue: { scrolled: () => NEVER } },
        { provide: InfiniteScrollStrategy, useClass: InfiniteScrollStrategy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchApiComponent);
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.inject(Router).navigate = navigate as unknown as Router['navigate'];
  });

  function facetsOf(request: SearchCall): string {
    return (request.facets ?? []).join(' ');
  }

  it('filters a podcast chip with the latched live field', () => {
    script = ['series', 'ok'];
    fixture.detectChanges();
    fixture.componentInstance.togglePodcast('Show A');

    expect(facetsOf(calls[0])).toContain('seriesName');
    expect(facetsOf(calls[1])).toContain('podcastName,count:1000');
    expect(calls[2].filter).toContain("search.in(podcastName, 'Show A'");
    expect(facetsOf(calls[2])).toContain('podcastName,count:1000');
    expect(calls).toHaveLength(3);
  });

  it('keeps seriesName on a podcast chip when the first search fails for another reason', () => {
    script = ['server'];
    fixture.detectChanges();
    fixture.componentInstance.togglePodcast('Show A');

    expect(calls).toHaveLength(2);
    expect(facetsOf(calls[0])).toContain('seriesName');
    expect(calls[1].filter).toContain("search.in(seriesName, 'Show A'");
    expect(fixture.nativeElement.textContent).toContain('Something went wrong');
  });

  it('clears the live-field latch when the retry fails so the next search uses seriesName', () => {
    script = ['series', 'server'];
    fixture.detectChanges();
    fixture.componentInstance.toggleSubject('Topic');

    expect(facetsOf(calls[0])).toContain('seriesName');
    expect(facetsOf(calls[1])).toContain('podcastName,count:1000');
    expect(facetsOf(calls[2])).toContain('seriesName');
    expect(facetsOf(calls[2])).not.toContain('podcastName');
  });

  it('drops a missing contentKind facet and does not latch the series field', () => {
    script = ['kind', 'ok'];
    fixture.detectChanges();

    expect(facetsOf(calls[0])).toContain('contentKind');
    expect(facetsOf(calls[0])).toContain('seriesName');
    expect(facetsOf(calls[1])).not.toContain('contentKind');
    expect(facetsOf(calls[1])).toContain('seriesName');
    expect(facetsOf(calls[1])).not.toContain('podcastName');
    expect(calls[1].filter ?? '').not.toContain('contentKind');
    expect(fixture.nativeElement.textContent).not.toContain('Something went wrong');
  });

  it('treats an unnamed missing-field response as contentKind before flipping the series latch', () => {
    script = ['unknown', 'ok'];
    fixture.detectChanges();

    expect(facetsOf(calls[0])).toContain('contentKind');
    expect(facetsOf(calls[1])).not.toContain('contentKind');
    expect(facetsOf(calls[1])).toContain('seriesName');
    expect(facetsOf(calls[1])).not.toContain('podcastName');
  });

  it('keeps every kind pill after one kind is selected', () => {
    page = searchPage([
      { value: 'Episode', count: 4 },
      { value: 'Film', count: 2 },
      { value: 'TvShowEpisode', count: 1 },
    ]);
    fixture.detectChanges();

    page = searchPage([{ value: 'Film', count: 2 }]);
    fixture.componentInstance.toggleKind('Film');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('All');
    expect(text).toContain('Podcast');
    expect(text).toContain('Film');
    expect(text).toContain('TV');
    expect(calls.at(-1)?.filter).toContain("search.in(contentKind, 'Film'");
  });

  describe('filters in the URL', () => {
    function chipsPage() {
      return {
        metadata: new Map<string, number>([['count', 3]]),
        entities: [],
        facets: {
          seriesName: [{ value: 'Show A', count: 2 }, { value: 'Show B', count: 1 }],
          subjects: [{ value: 'Topic X', count: 2 }, { value: 'Topic Y', count: 1 }],
          contentKind: [{ value: 'Episode', count: 2 }, { value: 'Film', count: 1 }],
        },
      };
    }

    function lastFragment(): string | undefined {
      return navigate.mock.calls.at(-1)?.[1]?.fragment;
    }

    beforeEach(() => {
      page = chipsPage() as unknown as ReturnType<typeof searchPage>;
    });

    it('loads with no fragment and no extra search when there are no filters', () => {
      fixture.detectChanges();

      expect(calls).toHaveLength(1);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('writes each chip click to the fragment as a new history entry, keeping the query string', () => {
      queryParams$.next({ sort: 'date-asc', page: '2' });
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.togglePodcast('Show A');
      expect(lastFragment()).toBe('show=Show A');
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({ queryParamsHandling: 'preserve', replaceUrl: false, scroll: 'manual' });

      component.toggleSubject('Topic X');
      component.toggleKind('Film');
      expect(lastFragment()).toBe('show=Show A&subject=Topic X&kind=Film');

      component.clearAllFilters();
      expect(lastFragment()).toBeUndefined();
      // Each click pushes; clearing to no fragment is pushed by duplicating the
      // filtered entry first (see writeUrlFragment), so the router call replaces.
      expect(navigate.mock.calls.map(([, extras]) => extras.replaceUrl)).toEqual([false, false, false, true]);

      // Nothing left to clear: no duplicate entry.
      component.clearAllFilters();
      component.clearPodcasts();
      expect(navigate).toHaveBeenCalledTimes(4);
    });

    it('restores each earlier selection on Back and the later one on Forward', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance as unknown as SearchApiComponent & { podcasts: () => string[]; subjects: () => string[] };
      component.togglePodcast('Show A');
      component.toggleSubject('Topic X');
      expect(lastFragment()).toBe('show=Show A&subject=Topic X');
      navigate.mockClear();

      fragment$.next('show=Show A');
      expect(component.podcasts()).toEqual(['Show A']);
      expect(component.subjects()).toEqual([]);
      expect(calls.at(-1)?.filter).toContain("search.in(seriesName, 'Show A'");
      expect(calls.at(-1)?.filter).not.toContain('Topic X');

      fragment$.next(null);
      expect(component.podcasts()).toEqual([]);
      expect(calls.at(-1)?.filter ?? '').toBe('');

      fragment$.next('show=Show A&subject=Topic X');
      expect(component.subjects()).toEqual(['Topic X']);
      expect(calls.at(-1)?.filter).toContain('Topic X');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('restores shows, subjects and kinds from a bookmarked fragment', () => {
      fragment$.next('show=Show A&subject=Topic X&kind=Film');
      fixture.detectChanges();

      expect(calls).toHaveLength(2);
      expect(calls[0].filter ?? '').toBe('');
      expect(calls[1].filter).toContain("search.in(seriesName, 'Show A'");
      expect(calls[1].filter).toContain('Topic X');
      expect(calls[1].filter).toContain("search.in(contentKind, 'Film'");
      expect(navigate).not.toHaveBeenCalled();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Show B');
      expect(text).toContain('Topic Y');
      expect(text).toContain('Clear filters');
    });

    it('ignores unknown values in the fragment and tidies it', () => {
      fragment$.next('show=Show A&show=Missing show&subject=Missing topic');
      fixture.detectChanges();

      expect(calls[1].filter).toContain("search.in(seriesName, 'Show A'");
      expect(calls[1].filter).not.toContain('Missing');
      expect(lastFragment()).toBe('show=Show A');
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({ replaceUrl: true });
    });

    it('searches once and tidies the URL when nothing in it is offered', () => {
      fragment$.next('show=Missing show');
      fixture.detectChanges();

      expect(calls).toHaveLength(1);
      expect(lastFragment()).toBeUndefined();
    });

    it('does not reload when the router echoes the URL the page wrote', () => {
      fixture.detectChanges();
      fixture.componentInstance.togglePodcast('Show A');
      const before = calls.length;

      fragment$.next('show=Show A');

      expect(calls.length).toBe(before);
    });

    it('keeps the filters when the sort changes', () => {
      fixture.detectChanges();
      fixture.componentInstance.togglePodcast('Show A');
      fixture.componentInstance.setSort('date-desc');

      expect(navigate.mock.calls.at(-1)).toEqual([
        ['/search/hello'],
        { queryParams: { sort: 'date-desc' }, fragment: 'show=Show A' },
      ]);
    });
  });
});
