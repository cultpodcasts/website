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

function serverError(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 500, statusText: 'Server Error', error: { message: 'timeout' } });
}

function searchPage() {
  return {
    metadata: new Map<string, number>([['count', 0]]),
    entities: [],
    facets: { podcastName: [], seriesName: [], subjects: [], lang: [] },
  };
}

describe('SearchApiComponent', () => {
  let fixture: ComponentFixture<SearchApiComponent>;
  let calls: SearchCall[];
  let script: Array<'unknown' | 'server' | 'ok'>;

  beforeEach(async () => {
    calls = [];
    script = ['ok'];
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
              if (next === 'server') {
                return throwError(() => serverError());
              }
              return of(searchPage());
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
    script = ['unknown', 'ok'];
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
    script = ['unknown', 'server'];
    fixture.detectChanges();
    fixture.componentInstance.toggleSubject('Topic');

    expect(facetsOf(calls[0])).toContain('seriesName');
    expect(facetsOf(calls[1])).toContain('podcastName,count:1000');
    expect(facetsOf(calls[2])).toContain('seriesName');
    expect(facetsOf(calls[2])).not.toContain('podcastName');
  });
});
