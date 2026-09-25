import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { SubjectApiComponent } from './subject-api.component';
import { ODataService } from '../odata.service';
import { SiteService } from '../site.service';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { PlayerService } from '../player.service';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';

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

  beforeEach(async () => {
    calls = [];
    respond = () => of(searchPage());
    await TestBed.configureTestingModule({
      imports: [SubjectApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ subjectName: 'Topic' }), queryParams: of({}) } },
        { provide: AuthServiceWrapper, useValue: { roles: of([]), isSignedIn: of(false) } },
        { provide: SiteService, useValue: { setQuery: () => undefined, setPodcast: () => undefined, setSubject: () => undefined, setFilter: () => undefined } },
        { provide: ODataService, useValue: { getEntitiesWithFacets: (_url: string, request: SearchCall) => { calls.push(request); return respond(request); } } },
        { provide: PlayerService, useValue: { episode: () => undefined, mode: () => 'dock', play: () => undefined, isQueuedId: () => false } },
        { provide: ScrollDispatcher, useValue: { scrolled: () => NEVER } },
        { provide: InfiniteScrollStrategy, useClass: InfiniteScrollStrategy },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubjectApiComponent);
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
});
