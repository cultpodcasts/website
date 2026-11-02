import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CataloguePlayableKind } from '../catalogue-playable-kind.enum';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { SubmitSeriesResolveService } from '../submit-series-resolve.service';
import { SubmitUrlLookupResponse } from '../submit-url-lookup.interface';
import { SubmitUrlLookupService } from '../submit-url-lookup.service';
import { SubmitUrlPrepareService } from '../submit-url-prepare.service';
import { SubmitPodcastComponent } from './submit-podcast.component';

describe('SubmitPodcastComponent known catalogue label', () => {
  let fixture: ComponentFixture<SubmitPodcastComponent>;
  let component: SubmitPodcastComponent;

  async function create() {
    await TestBed.configureTestingModule({
      imports: [SubmitPodcastComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        {
          provide: AuthServiceWrapper,
          useValue: {
            roles: of(['Curator']),
            authService: { getAccessTokenSilently: () => of('test-token') }
          }
        },
        { provide: SearchSuggestionsService, useValue: { preload: vi.fn(), suggest: async () => [] } },
        { provide: SubmitSeriesResolveService, useValue: {} },
        { provide: SubmitUrlLookupService, useValue: { lookup: async () => ({ known: false, kind: 'podcast-service' }) } },
        { provide: SubmitUrlPrepareService, useValue: { prepare: async () => ({ podcastName: null }) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SubmitPodcastComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function setKnownLookup(lookup: Extract<SubmitUrlLookupResponse, { known: true }>) {
    // Simulate a finished lookup for a YouTube episode URL so seriesUi is readonly.
    (component as unknown as {
      lookup: { set: (v: SubmitUrlLookupResponse) => void };
      urlText: { set: (v: string) => void };
      lookupPending: { set: (v: boolean) => void };
      lookedUpHref: { set: (v: string | null) => void };
    }).lookup.set(lookup);
    (component as unknown as { urlText: { set: (v: string) => void } })
      .urlText.set('https://www.youtube.com/watch?v=abcdefghijk');
    (component as unknown as { lookupPending: { set: (v: boolean) => void } }).lookupPending.set(false);
    (component as unknown as { lookedUpHref: { set: (v: string | null) => void } })
      .lookedUpHref.set('https://www.youtube.com/watch?v=abcdefghijk');
    fixture.detectChanges();
  }

  function knownLabel(): string {
    return (fixture.nativeElement as HTMLElement)
      .querySelector('#submit-known-catalogue')
      ?.textContent
      ?.trim() ?? '';
  }

  function hasSeriesPicker(): boolean {
    return !!(fixture.nativeElement as HTMLElement).querySelector('mat-expansion-panel');
  }

  beforeEach(async () => {
    await create();
  });

  it('shows Already in the catalogue as Film for a known Film without podcast id/name', () => {
    setKnownLookup({
      known: true,
      kind: 'podcast-service',
      contentKind: CataloguePlayableKind.Film,
      podcastId: null,
      podcastName: null,
      parentName: null
    });
    expect(knownLabel()).toBe('Already in the catalogue as Film');
    expect(hasSeriesPicker()).toBe(false);
  });

  it('shows TV: {parentName} for a known TV episode and does not offer a Series picker', () => {
    setKnownLookup({
      known: true,
      kind: 'streaming',
      service: 'netflix',
      contentKind: CataloguePlayableKind.TvShowEpisode,
      parentName: 'Nightly Synthetic'
    });
    expect(knownLabel()).toBe('TV: Nightly Synthetic');
    expect(hasSeriesPicker()).toBe(false);
  });

  it('shows News: {parentName} for a known news report and does not offer a Series picker', () => {
    setKnownLookup({
      known: true,
      contentKind: CataloguePlayableKind.NewsReport,
      parentName: 'Synthetic Desk'
    });
    expect(knownLabel()).toBe('News: Synthetic Desk');
    expect(hasSeriesPicker()).toBe(false);
  });

  it('shows Series: {podcastName} for a known podcast Episode', () => {
    setKnownLookup({
      known: true,
      podcastId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      podcastName: 'Stored Show Name',
      contentKind: CataloguePlayableKind.Episode
    });
    expect(knownLabel()).toBe('Series: Stored Show Name');
    expect(hasSeriesPicker()).toBe(false);
  });
});
