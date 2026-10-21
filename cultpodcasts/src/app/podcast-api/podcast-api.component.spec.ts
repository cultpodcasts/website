import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NEVER, of, throwError, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
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
  let routeParams: BehaviorSubject<Record<string, string>>;
  let routeSnapshot: { fragment: string | null; params: Record<string, string>; queryParams: Record<string, string> };
  let routeFragment: BehaviorSubject<string | null>;
  let facetsPage: ReturnType<typeof searchPage>;

  beforeEach(async () => {
    calls = [];
    script = ['ok'];
    routeParams = new BehaviorSubject<Record<string, string>>({ podcastName: 'Show A' });
    routeSnapshot = { fragment: null, params: { podcastName: 'Show A' }, queryParams: {} };
    routeFragment = new BehaviorSubject<string | null>(null);
    facetsPage = searchPage();
    await TestBed.configureTestingModule({
      imports: [PodcastApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: routeParams.asObservable(), queryParams: of({}), fragment: routeFragment.asObservable(), snapshot: routeSnapshot } },
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
              return of(facetsPage);
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

  it('afterClosed { transferred: true, targetKind: TvShow } navigates [\'/tv\', \'Show A\']', () => {
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    const dialog = TestBed.inject(MatDialog);
    vi.mocked(dialog.open).mockReturnValue({
      afterClosed: () => of({ transferred: true, targetKind: CatalogueParentKind.TvShow })
    } as ReturnType<MatDialog['open']>);

    fixture.componentInstance.editPodcast();

    expect(navigate).toHaveBeenCalledWith(['/tv', 'Show A']);
  });

  it('afterClosed { transferred: true, targetKind: NewsOrganisation } navigates [\'/news\', \'Show A\']', () => {
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    const dialog = TestBed.inject(MatDialog);
    vi.mocked(dialog.open).mockReturnValue({
      afterClosed: () => of({ transferred: true, targetKind: CatalogueParentKind.NewsOrganisation })
    } as ReturnType<MatDialog['open']>);

    fixture.componentInstance.editPodcast();

    expect(navigate).toHaveBeenCalledWith(['/news', 'Show A']);
  });
  describe('subject chips in the URL fragment', () => {
    let navigate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      facetsPage = {
        ...searchPage(),
        facets: { podcastName: [], subjects: [{ value: 'Topic X', count: 2 }, { value: 'Topic Y', count: 1 }] },
      } as unknown as ReturnType<typeof searchPage>;
      navigate = vi.fn().mockResolvedValue(true);
      TestBed.inject(Router).navigate = navigate as unknown as Router['navigate'];
    });

    it('writes subject clicks to the fragment as new history entries and keeps them on sort', () => {
      fixture.detectChanges();
      expect(navigate).not.toHaveBeenCalled();

      fixture.componentInstance.toggleSubject('Topic X');
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({
        fragment: 'subject=Topic X',
        queryParamsHandling: 'preserve',
        replaceUrl: false,
        scroll: 'manual',
      });

      fixture.componentInstance.setSort('date-asc');
      expect(navigate.mock.calls.at(-1)).toEqual([
        ['/podcast/Show A'],
        { queryParams: { sort: 'date-asc' }, fragment: 'subject=Topic X' },
      ]);
    });

    it('restores subjects from a bookmarked fragment after the unfiltered facets load', () => {
      routeSnapshot.fragment = 'subject=Topic Y&subject=Missing topic';
      routeFragment.next(routeSnapshot.fragment);
      fixture.detectChanges();

      expect(calls).toHaveLength(2);
      expect(calls[0].filter).toBe("(seriesName eq 'Show A')");
      expect(calls[1].filter).toContain('Topic Y');
      expect(calls[1].filter).not.toContain('Missing');
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({ fragment: 'subject=Topic Y', replaceUrl: true });
      const component = fixture.componentInstance as unknown as { facets: () => { subjects?: { value: string }[] }; subjects: () => string[] };
      expect(component.facets().subjects?.map(subject => subject.value)).toEqual(['Topic X', 'Topic Y']);
      expect(component.subjects()).toEqual(['Topic Y']);
    });

    /** Browser Back/Forward: the router updates the snapshot, then emits the fragment. */
    function travelTo(fragment: string | null): void {
      routeSnapshot.fragment = fragment;
      routeFragment.next(fragment);
    }

    it('restores each selection on Back and Forward without writing history', () => {
      fixture.detectChanges();
      const component = fixture.componentInstance as unknown as { subjects: () => string[] } & PodcastApiComponent;
      component.toggleSubject('Topic X');
      component.toggleSubject('Topic Y');
      travelTo('subject=Topic X&subject=Topic Y');
      navigate.mockClear();
      calls.length = 0;

      travelTo('subject=Topic X');
      expect(component.subjects()).toEqual(['Topic X']);
      expect(calls.at(-1)?.filter).toContain('Topic X');
      expect(calls.at(-1)?.filter).not.toContain('Topic Y');

      travelTo(null);
      expect(component.subjects()).toEqual([]);
      expect(calls.at(-1)?.filter).toBe("(seriesName eq 'Show A')");

      travelTo('subject=Topic X');
      expect(component.subjects()).toEqual(['Topic X']);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('ignores the echo of its own write and a fragment that arrives with a new podcast', () => {
      fixture.detectChanges();
      fixture.componentInstance.toggleSubject('Topic X');
      const before = calls.length;

      travelTo('subject=Topic X');
      expect(calls.length).toBe(before);

      routeSnapshot.params = { podcastName: 'Show B' };
      travelTo('subject=Topic Y');
      expect(calls.length).toBe(before);
    });

    it('clears the fragment when a chip is toggled on and off before the router settles', () => {
      fixture.detectChanges();

      fixture.componentInstance.toggleSubject('Topic X');
      fixture.componentInstance.toggleSubject('Topic X');

      expect(navigate.mock.calls.map(call => call[1].fragment)).toEqual(['subject=Topic X', undefined]);
    });

    it('reloads from podcast-wide facets after a sort change, then reapplies the chips from the fragment', () => {
      fixture.detectChanges();
      fixture.componentInstance.toggleSubject('Topic X');
      const before = calls.length;

      routeSnapshot.fragment = 'subject=Topic X';
      routeFragment.next(routeSnapshot.fragment);
      routeParams.next({ podcastName: 'Show A' });

      expect(calls.slice(before).map(call => call.filter)).toEqual([
        "(seriesName eq 'Show A')",
        expect.stringContaining('Topic X'),
      ]);
    });

    it('searches once and clears the fragment when no restored subject is offered', () => {
      routeSnapshot.fragment = 'subject=Missing topic';
      routeFragment.next(routeSnapshot.fragment);
      fixture.detectChanges();

      expect(calls).toHaveLength(1);
      expect(navigate.mock.calls.at(-1)?.[1].fragment).toBeUndefined();
    });
  });
});
