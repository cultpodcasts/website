import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NEVER, of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { PodcastApiComponent } from './podcast-api.component';
import { ODataService } from '../odata.service';
import { SiteService } from '../site.service';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { PlayerService } from '../player.service';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { SubmitSeriesResolveService } from '../submit-series-resolve.service';
import { SubmitUrlLookupService } from '../submit-url-lookup.service';

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
    facets: { podcastName: [], subjects: [] },
  };
}

describe('PodcastApiComponent', () => {
  let fixture: ComponentFixture<PodcastApiComponent>;
  let calls: SearchCall[];
  let script: Array<'unknown' | 'server' | 'ok'>;

  beforeEach(async () => {
    calls = [];
    script = ['ok'];
    await TestBed.configureTestingModule({
      imports: [PodcastApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ podcastName: 'Show A' }), queryParams: of({}) } },
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
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: SubmitSeriesResolveService, useValue: {} },
        { provide: SubmitUrlLookupService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastApiComponent);
  });

  it('retries podcastName once when seriesName is an unknown field', () => {
    script = ['unknown', 'ok'];
    fixture.detectChanges();

    expect(calls[0].filter).toContain("(seriesName eq 'Show A')");
    expect(calls[1].filter).toContain("(podcastName eq 'Show A')");
    expect(calls).toHaveLength(2);
  });

  it('does not latch the live field when the podcast page fails for another reason', () => {
    script = ['server'];
    fixture.detectChanges();

    expect(calls).toHaveLength(1);
    expect(calls[0].filter).toContain("(seriesName eq 'Show A')");
    expect(fixture.nativeElement.textContent).toContain('Something went wrong');
  });

  it('clears the live-field latch when the retry fails so the next search uses seriesName', () => {
    script = ['unknown', 'server'];
    fixture.detectChanges();
    fixture.componentInstance.toggleSubject('Topic');

    expect(calls[0].filter).toContain("(seriesName eq 'Show A')");
    expect(calls[1].filter).toContain("(podcastName eq 'Show A')");
    expect(calls[2].filter).toContain("(seriesName eq 'Show A')");
    expect(calls[2].filter).not.toContain('podcastName');
  });
});
