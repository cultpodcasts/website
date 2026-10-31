import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { NEVER, of, Subject } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoveryBanService } from '../discovery-ban.service';
import { DiscoveryCurationSessionService } from '../discovery-curation-session.service';
import { DiscoveryCurationSessionSnapshot } from '../discovery-curation-session.interface';
import { DiscoveryResult } from '../discovery-result.interface';
import { DiscoverySubmitOutcomeState } from '../discovery-submit-outcome-state.enum';
import { SiteService } from '../site.service';
import { DiscoverySubmissionsService } from '../discovery-supervision/discovery-submissions.service';
import { SubmitDiscoveryState } from '../submit-discovery-state.interface';
import { DiscoveryApiComponent } from './discovery-api.component';

describe('DiscoveryApiComponent reconcile and confirm', () => {
  const idA = 'a1111111-0000-4000-8000-000000000001';
  const idB = 'a1111111-0000-4000-8000-000000000002';

  function card(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
    return {
      id: idA,
      urls: { spotify: undefined, apple: undefined, youtube: undefined },
      episodeName: 'Synthetic episode',
      showName: 'Synthetic show',
      episodeDescription: 'desc',
      showDescription: undefined,
      released: new Date('2026-10-01T10:00:00Z'),
      duration: undefined,
      subjects: [],
      youTubeViews: undefined,
      youTubeChannelMembers: undefined,
      containsSyntheticMedia: undefined,
      guests: undefined,
      imageUrl: undefined,
      enrichedTimeFromApple: false,
      enrichedUrlFromSpotify: false,
      matchingPodcasts: null,
      acceptProbability: 0.9,
      autoHidden: false,
      isFocused: undefined,
      youTubeChannelId: undefined,
      ...overrides
    };
  }

  function emptySnap(overrides: Partial<DiscoveryCurationSessionSnapshot> = {}): DiscoveryCurationSessionSnapshot {
    return {
      includedDocumentIds: [],
      pendingDocumentIds: [],
      selectedResultIds: [],
      votesByResultId: {},
      presence: {},
      rev: 1,
      updatedAt: new Date('2026-10-24T00:00:00Z'),
      ...overrides
    };
  }

  let sessionSnapshot: ReturnType<typeof signal<DiscoveryCurationSessionSnapshot | null>>;
  let clearVotes: ReturnType<typeof vi.fn>;
  let includePending: ReturnType<typeof vi.fn>;
  let setVote: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionSnapshot = signal<DiscoveryCurationSessionSnapshot | null>(emptySnap());
    clearVotes = vi.fn().mockResolvedValue(undefined);
    includePending = vi.fn().mockResolvedValue(true);
    setVote = vi.fn().mockResolvedValue(undefined);
    snackOpen = vi.fn().mockReturnValue({ onAction: () => NEVER });
    dialogOpen = vi.fn();

    await TestBed.configureTestingModule({
      imports: [DiscoveryApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: AuthServiceWrapper,
          useValue: { roles: of([]), authService: { getAccessTokenSilently: () => of('token') } }
        },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        {
          provide: SiteService,
          useValue: { setQuery: () => undefined, setPodcast: () => undefined, setSubject: () => undefined }
        },
        { provide: DiscoverySubmissionsService, useValue: {} },
        { provide: DiscoveryBanService, useValue: { ban: vi.fn() } },
        {
          provide: DiscoveryCurationSessionService,
          useValue: {
            snapshot: sessionSnapshot,
            connected: signal(false),
            refreshError: signal(false),
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn(),
            syncDocuments: vi.fn().mockResolvedValue(true),
            includePending,
            setVote,
            clearVotes
          }
        }
      ]
    }).compileComponents();
  });

  function createComponent(): DiscoveryApiComponent {
    const fixture = TestBed.createComponent(DiscoveryApiComponent);
    return fixture.componentInstance;
  }

  it('full Accepted reconcile hides Save, marks submitted, and clears Accepted votes', async () => {
    const component = createComponent();
    const submit = vi.fn().mockResolvedValue(undefined);
    const afterClosed = new Subject<SubmitDiscoveryState | undefined>();
    dialogOpen.mockReturnValue({
      componentInstance: { submit },
      afterClosed: () => afterClosed.asObservable()
    });

    component.results.set([card({ id: idA }), card({ id: idB, episodeName: 'Other' })]);
    component.documentIds.set(['doc-1']);
    component.selectedIds.set([idA, idB]);
    component.displaySave.set(true);
    component.submitted.set(false);

    const savePromise = component.save();
    await Promise.resolve();
    afterClosed.next({
      hasErrors: false,
      erroredItems: [],
      allErrored: false,
      endpointError: false,
      episodeIds: ['pod/ep'],
      reconciledOutcomes: [
        { discoveryItemId: idA, state: DiscoverySubmitOutcomeState.Accepted },
        { discoveryItemId: idB, state: DiscoverySubmitOutcomeState.Accepted }
      ]
    });
    afterClosed.complete();
    await savePromise;
    await Promise.resolve();

    expect(component.displaySave()).toBe(false);
    expect(component.submitted()).toBe(true);
    expect(clearVotes).toHaveBeenCalledWith([idA, idB]);
    expect(snackOpen).toHaveBeenCalled();
    const msg = String(snackOpen.mock.calls[0][0]);
    expect(msg).toContain('2 submitted');
  });

  it('Accepted+Rejected reconcile keeps Save visible and does not clear as a full win', async () => {
    const component = createComponent();
    const submit = vi.fn().mockResolvedValue(undefined);
    const afterClosed = new Subject<SubmitDiscoveryState | undefined>();
    dialogOpen.mockReturnValue({
      componentInstance: { submit },
      afterClosed: () => afterClosed.asObservable()
    });

    component.results.set([card({ id: idA }), card({ id: idB, episodeName: 'Other' })]);
    component.documentIds.set(['doc-1']);
    component.selectedIds.set([idA, idB]);
    component.displaySave.set(true);
    component.submitted.set(false);

    const savePromise = component.save();
    await Promise.resolve();
    afterClosed.next({
      hasErrors: false,
      erroredItems: [],
      allErrored: false,
      endpointError: false,
      reconciledOutcomes: [
        { discoveryItemId: idA, state: DiscoverySubmitOutcomeState.Accepted },
        { discoveryItemId: idB, state: DiscoverySubmitOutcomeState.Rejected }
      ]
    });
    afterClosed.complete();
    await savePromise;
    await Promise.resolve();

    expect(component.displaySave()).toBe(true);
    expect(component.submitted()).toBe(false);
    expect(clearVotes).not.toHaveBeenCalled();
    const msg = String(snackOpen.mock.calls[0][0]);
    expect(msg).toContain('rejected');
  });

  it('confirmSubmit warns about pending newer reports when all visible are selected', async () => {
    const component = createComponent();
    sessionSnapshot.set(emptySnap({ pendingDocumentIds: ['pending-doc-1', 'pending-doc-2'], rev: 2 }));
    const submit = vi.fn().mockResolvedValue(undefined);
    const confirmClosed = new Subject<{ result: boolean } | undefined>();
    dialogOpen.mockReturnValue({
      componentInstance: { submit },
      afterClosed: () => confirmClosed.asObservable()
    });

    component.results.set([card({ id: idA })]);
    component.documentIds.set(['doc-1']);
    component.selectedIds.set([idA]);
    component.hiddenCount.set(0);

    const savePromise = component.save();
    await Promise.resolve();

    expect(dialogOpen).toHaveBeenCalled();
    const confirmData = dialogOpen.mock.calls[0][1]?.data as { question: string; title: string };
    expect(confirmData.title).toBe('Confirm Submit');
    expect(confirmData.question).toContain('2 newer report(s) will be left for later');

    confirmClosed.next({ result: false });
    confirmClosed.complete();
    await savePromise;

    expect(submit).not.toHaveBeenCalled();
  });

  it('includePendingDocuments snacks and skips reload when include fails', async () => {
    const component = createComponent();
    includePending.mockResolvedValue(false);
    const loadSpy = vi.spyOn(component, 'loadResults');

    component.includePendingDocuments();
    await Promise.resolve();
    await Promise.resolve();

    expect(includePending).toHaveBeenCalledWith('all');
    expect(loadSpy).not.toHaveBeenCalled();
    expect(snackOpen).toHaveBeenCalledWith(
      'Could not include newer reports. Try again.',
      'Ok',
      expect.objectContaining({ duration: 10000 })
    );
  });

  it('keeps optimistic multi-select while a partial session snapshot arrives', async () => {
    const component = createComponent();
    const a = card({ id: idA, acceptProbability: 0.9 });
    const b = card({ id: idB, episodeName: 'Other', acceptProbability: 0.8 });
    component.results.set([a, b]);
    sessionSnapshot.set(emptySnap({ rev: 1, selectedResultIds: [] }));
    TestBed.flushEffects();

    component.selectLikelyMatches();
    expect(component.selectedIds().sort()).toEqual([idA, idB].sort());

    // Partial WS echo — must not stomp optimistic selection.
    sessionSnapshot.set(emptySnap({ rev: 2, selectedResultIds: [idA] }));
    TestBed.flushEffects();
    expect(component.selectedIds().sort()).toEqual([idA, idB].sort());

    // Full ack matches local — pending clears; deep-equal skip keeps selection.
    sessionSnapshot.set(emptySnap({ rev: 3, selectedResultIds: [idA, idB] }));
    TestBed.flushEffects();
    expect(component.selectedIds().sort()).toEqual([idA, idB].sort());

    // Remote peer deselects after ack — apply when no pending and rev advances.
    sessionSnapshot.set(emptySnap({ rev: 4, selectedResultIds: [idA] }));
    TestBed.flushEffects();
    expect(component.selectedIds()).toEqual([idA]);
  });
});
