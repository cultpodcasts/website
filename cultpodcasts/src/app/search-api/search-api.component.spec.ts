import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NEVER, of, throwError } from 'rxjs';
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

  beforeEach(async () => {
    calls = [];
    script = ['ok'];
    page = searchPage();
    await TestBed.configureTestingModule({
      imports: [SearchApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ query: 'hello' }), queryParams: of({}) } },
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
});
