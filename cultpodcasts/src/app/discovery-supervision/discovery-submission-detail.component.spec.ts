import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, PLATFORM_ID, input, provideZonelessChangeDetection } from '@angular/core';
import { EpisodesApiComponent } from '../episodes-api/episodes-api.component';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoverySubmissionDetailComponent } from './discovery-submission-detail.component';
import { DiscoverySubmissionsService } from './discovery-submissions.service';
import { DiscoverySubmissionDetail } from './discovery-supervision.models';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'aaaaaaaa-0000-4000-8000-000000000002';
const C = 'aaaaaaaa-0000-4000-8000-000000000003';

function result(id: string, name: string) {
  return {
    id, urls: {}, episodeName: name, showName: 'Show', episodeDescription: 'd', showDescription: undefined,
    released: '2026-10-01T10:00:00Z', duration: undefined, subjects: ['Scientology'],
    subjectMatches: [{ subject: 'Scientology', term: 'Hubbard', source: 'Title' }],
    youTubeViews: undefined, youTubeChannelMembers: undefined, containsSyntheticMedia: undefined, guests: undefined,
    imageUrl: undefined, enrichedTimeFromApple: false, enrichedUrlFromSpotify: false, matchingPodcasts: null,
    acceptProbability: 0.7, autoHidden: false, isFocused: undefined
  };
}

function detail(overrides: Partial<DiscoverySubmissionDetail> = {}): DiscoverySubmissionDetail {
  return {
    id: 's1', status: 'Pending', etag: 'e1', canReview: true, submitterSubject: 'ai-bot',
    submittedAt: '2026-10-11T10:00:00Z', submitterAcceptedResultIds: [A, B], itemComments: [],
    reports: [{ id: 'r1', discoveryBegan: '2026-10-11T09:00:00Z', state: 'PendingSupervisor', results: [result(A, 'One'), result(B, 'Two'), result(C, 'Three')] as never }],
    history: [{ at: '2026-10-11T10:00:00Z', action: 'Submitted', actorSubject: 'ai-bot' }],
    ...overrides
  };
}

/** Stands in for the real /episodes card list (its own behaviour is covered in episodes-api.component.spec.ts). */
@Component({ selector: 'app-episodes-api', template: '<div class="stub-episodes" [attr.data-ids]="ids()"></div>' })
class StubEpisodesApiComponent {
  readonly episodeIds = input<readonly string[] | undefined>(undefined);
  readonly embedded = input(false);
  readonly heading = input('');
  protected ids = () => JSON.stringify(this.episodeIds() ?? []);
}

describe('DiscoverySubmissionDetailComponent', () => {
  let fixture: ComponentFixture<DiscoverySubmissionDetailComponent>;
  let service: {
    get: ReturnType<typeof vi.fn>; saveReview: ReturnType<typeof vi.fn>; apply: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>; changeState: ReturnType<typeof vi.fn>;
  };
  let dialogOpen: ReturnType<typeof vi.fn>;
  let roles: BehaviorSubject<string[]>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let snackAction: Subject<void>;

  async function create(d: DiscoverySubmissionDetail) {
    service.get.mockReturnValue(of(d));
    fixture = TestBed.createComponent(DiscoverySubmissionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const card = (id: string) => el().querySelector(`.review-item[data-result-id="${id}"]`) as HTMLElement;
  const button = (cls: string) => el().querySelector(`button.${cls}`) as HTMLButtonElement;

  beforeEach(async () => {
    service = {
      get: vi.fn(),
      saveReview: vi.fn().mockReturnValue(of({ submissionId: 's1', status: 'Pending', etag: 'e2' })),
      apply: vi.fn().mockReturnValue(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [] })),
      retry: vi.fn().mockReturnValue(of({ submissionId: 's1', status: 'Applied' })),
      release: vi.fn().mockReturnValue(of({ submissionId: 's1', status: 'Released' })),
      changeState: vi.fn().mockReturnValue(of({ submissionId: 's1', status: 'Pending' }))
    };
    roles = new BehaviorSubject<string[]>(['Supervisor']);
    snackAction = new Subject<void>();
    snackOpen = vi.fn().mockReturnValue({ onAction: () => snackAction });
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of({ result: true }) });
    await TestBed.configureTestingModule({
      imports: [DiscoverySubmissionDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 's1' }), data: {} } } },
        { provide: DiscoverySubmissionsService, useValue: service },
        { provide: AuthServiceWrapper, useValue: { roles } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen } }
      ]
    })
      .overrideComponent(DiscoverySubmissionDetailComponent, {
        remove: { imports: [EpisodesApiComponent] },
        add: { imports: [StubEpisodesApiComponent] }
      })
      .compileComponents();
  });

  const showAll = () => {
    fixture.componentInstance['filter'].set('all');
    fixture.detectChanges();
  };

  it('opens on the submitter picks only, with the unpicked results one toggle away', async () => {
    await create(detail());
    expect(card(A).dataset['pick']).toBe('kept');
    expect(card(B).dataset['pick']).toBe('kept');
    expect(card(C)).toBeNull();
    expect(el().querySelector('.supervision-filter')?.textContent).toContain('Picks & changes (2)');
    expect(el().querySelector('.supervision-filter')?.textContent).toContain('All results (3)');
    showAll();
    expect(card(C).dataset['pick']).toBe('none');
    expect(card(A).querySelector('.mat-mdc-tooltip-trigger')).not.toBeNull();
  });

  it('keeps a deselected pick visible as removed in the picks view, so it can be re-selected', async () => {
    await create(detail());
    (card(A).querySelector('mat-card') as HTMLElement).click();
    fixture.detectChanges();
    expect(card(A).dataset['pick']).toBe('removed');
    expect(button('apply').textContent).toContain('Apply 1');
  });

  it('hides comment boxes until asked for, so the review grid stays uncluttered', async () => {
    await create(detail());
    expect(el().querySelector('textarea')).toBeNull();
    (card(A).querySelector('button.add-item-comment') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(card(A).querySelector('textarea')).not.toBeNull();
    expect(card(B).querySelector('textarea')).toBeNull();
  });

  it('keeps loaded comment fields mounted when cleared, so clearing does not collapse mid-edit', async () => {
    await create(detail({
      reportComment: 'Draft note',
      itemComments: [{ resultId: A, comment: 'Check guest' }]
    }));
    const reportArea = el().querySelector('.report-comment textarea') as HTMLTextAreaElement;
    const itemArea = card(A).querySelector('textarea') as HTMLTextAreaElement;
    expect(reportArea).not.toBeNull();
    expect(itemArea).not.toBeNull();
    expect(reportArea.value).toBe('Draft note');
    expect(itemArea.value).toBe('Check guest');

    reportArea.value = '';
    reportArea.dispatchEvent(new Event('input'));
    itemArea.value = '';
    itemArea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el().querySelector('.report-comment textarea')).not.toBeNull();
    expect(card(A).querySelector('textarea')).not.toBeNull();
    expect(el().querySelector('button.add-report-comment')).toBeNull();

    button('save-draft').click();
    await fixture.whenStable();
    expect(service.saveReview).toHaveBeenCalledWith('s1', {
      etag: 'e1',
      reportComment: '',
      itemComments: [],
      acceptedResultIds: [A, B]
    });
  });


  it('lets the supervisor add a missed result and remove a wrong one, then apply the reworked set with comments', async () => {
    await create(detail());
    showAll();
    (card(C).querySelector('mat-card') as HTMLElement).click();
    (card(A).querySelector('mat-card') as HTMLElement).click();
    fixture.detectChanges();
    expect(card(C).dataset['pick']).toBe('added');
    expect(card(A).dataset['pick']).toBe('removed');
    expect(el().textContent).toContain('+1 added');
    expect(el().textContent).toContain('−1 removed');

    (card(C).querySelector('button.add-item-comment') as HTMLButtonElement).click();
    (el().querySelector('button.add-report-comment') as HTMLButtonElement).click();
    fixture.detectChanges();
    const itemComment = card(C).querySelector('textarea') as HTMLTextAreaElement;
    itemComment.value = 'AI missed this guest';
    itemComment.dispatchEvent(new Event('input'));
    const reportComment = el().querySelector('.report-comment textarea') as HTMLTextAreaElement;
    reportComment.value = 'Good run overall';
    reportComment.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    button('apply').click();
    await fixture.whenStable();

    expect(service.saveReview).toHaveBeenCalledWith('s1', {
      etag: 'e1',
      reportComment: 'Good run overall',
      itemComments: [{ resultId: C, comment: 'AI missed this guest' }],
      acceptedResultIds: [B, C]
    });
    expect(service.apply).toHaveBeenCalledWith('s1', 'e2', [B, C]);
  });

  it('is read-only for the submitter and shows supervisor comments and failure reasons', async () => {
    await create(detail({
      canReview: false, status: 'PartiallyApplied', supervisorAcceptedResultIds: [B, C], reportComment: 'Missed one',
      itemComments: [{ resultId: C, comment: 'look for guest names' }],
      itemOutcomes: [
        { resultId: B, state: 'Succeeded', attempts: 1, message: 'Created' },
        { resultId: C, state: 'Failed', attempts: 1, message: 'Error', error: 'TimeoutException: Spotify' }
      ]
    }));
    expect(button('apply')).toBeNull();
    expect(el().querySelector('textarea')).toBeNull();
    expect(el().textContent).toContain('Missed one');
    expect(card(C).textContent).toContain('look for guest names');
    expect(card(C).textContent).toContain('TimeoutException: Spotify');
    (card(B).querySelector('mat-card') as HTMLElement).click();
    fixture.detectChanges();
    expect(card(B).dataset['pick']).toBe('kept');
  });

  it('retries failed items, abandoning ticked ones', async () => {
    await create(detail({
      status: 'PartiallyApplied', supervisorAcceptedResultIds: [B, C],
      itemOutcomes: [
        { resultId: B, state: 'Failed', attempts: 1, error: 'x' },
        { resultId: C, state: 'Failed', attempts: 2, error: 'y' }
      ]
    }));
    expect(button('release')).toBeNull();
    const checkbox = el().querySelector('.retry-panel input[type=checkbox]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    button('retry').click();
    await fixture.whenStable();
    expect(service.retry).toHaveBeenCalledWith('s1', 'e1', [B]);
  });

  it('shows Applying as in progress with every supervisor action unavailable', async () => {
    await create(detail({ status: 'Applying', inProgressOperation: 'Retry', inProgressSince: '2026-10-11T10:00:00Z' }));
    expect(el().querySelector('.in-progress')?.textContent).toContain('Retrying failed items');
    for (const cls of ['apply', 'save-draft', 'retry', 'release', 'change-state']) {
      expect(button(cls)).toBeNull();
    }
    expect(el().querySelector('textarea')).toBeNull();
    expect(el().querySelector('.in-progress-admin-note')).toBeNull();
  });

  it('points admins at Change state while Applying', async () => {
    roles.next(['Admin']);
    await create(detail({ status: 'Applying', inProgressOperation: 'Apply', inProgressSince: '2026-10-11T10:00:00Z' }));
    expect(el().querySelector('.in-progress-admin-note')?.textContent).toContain('Change state');
    expect(button('change-state')).not.toBeNull();
  });

  it('lets an admin change state after confirming, then reloads', async () => {
    roles.next(['Admin']);
    await create(detail({ status: 'Applying', inProgressOperation: 'Apply', inProgressSince: '2026-10-11T10:00:00Z' }));
    const component = fixture.componentInstance as unknown as { newStatus: { set(v: string): void } };
    expect(button('change-state').disabled).toBe(true);
    component.newStatus.set('Pending');
    const reason = el().querySelector('input.state-reason') as HTMLInputElement;
    reason.value = 'Apply crashed';
    reason.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const loads = service.get.mock.calls.length;
    button('change-state').click();
    await fixture.whenStable();
    expect(dialogOpen).toHaveBeenCalled();
    expect(service.changeState).toHaveBeenCalledWith('s1', 'Pending', 'e1', 'Apply crashed');
    expect(service.get.mock.calls.length).toBe(loads + 1);
  });

  it('does not change state when the admin cancels the confirmation', async () => {
    roles.next(['Admin']);
    dialogOpen.mockReturnValue({ afterClosed: () => of({ result: false }) });
    await create(detail({ status: 'Applied' }));
    (fixture.componentInstance as unknown as { newStatus: { set(v: string): void } }).newStatus.set('Released');
    fixture.detectChanges();
    button('change-state').click();
    await fixture.whenStable();
    expect(service.changeState).not.toHaveBeenCalled();
  });

  it('hides Change state from non-admins and shows StateChanged history', async () => {
    await create(detail({ history: [
      { at: '2026-10-11T10:00:00Z', action: 'StateChanged', actorSubject: 'jon', fromStatus: 'Applying', toStatus: 'Pending', reason: 'crashed' }
    ] }));
    expect(button('change-state')).toBeNull();
    expect(el().querySelector('.history')?.textContent).toContain('State changed Applying → Pending: crashed');
  });

  it('releases the lock with a reason', async () => {
    await create(detail());
    const reason = el().querySelector('.release-panel input') as HTMLInputElement;
    reason.value = 'Wrong batch';
    reason.dispatchEvent(new Event('input'));
    button('release').click();
    await fixture.whenStable();
    expect(service.release).toHaveBeenCalledWith('s1', 'e1', 'Wrong batch');
  });

  it('keeps unsaved edits and explains a conflict when apply fails', async () => {
    await create(detail());
    service.apply.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Report changed' } })));
    showAll();
    (card(C).querySelector('mat-card') as HTMLElement).click();
    fixture.detectChanges();
    button('apply').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('[role=alert]')?.textContent).toContain('Report changed');
    expect(card(C).dataset['pick']).toBe('added');
  });

  describe('reviewing ingested episodes', () => {
    const E1 = 'eeeeeeee-0000-4000-8000-000000000001';
    const E2 = 'eeeeeeee-0000-4000-8000-000000000002';
    const reviewLink = () => el().querySelector('a.review-ingested') as HTMLAnchorElement | null;

    beforeEach(() => roles.next(['Supervisor', 'Curator']));

    it('offers a Review action after Apply that opens the ingested episodes for editing', async () => {
      service.apply.mockReturnValue(of({
        submissionId: 's1', status: 'PartiallyApplied', itemOutcomes: [
          { resultId: A, state: 'Succeeded', attempts: 1, episodeId: E1 },
          { resultId: B, state: 'Failed', attempts: 1, error: 'x' },
          { resultId: C, state: 'Succeeded', attempts: 1, episodeId: E2 }
        ]
      }));
      await create(detail());
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button('apply').click();
      await fixture.whenStable();
      expect(snackOpen).toHaveBeenCalledWith(expect.stringContaining('1 item(s) failed'), 'Review', expect.anything());
      expect(navigate).not.toHaveBeenCalled();
      snackAction.next();
      expect(navigate).toHaveBeenCalledWith(['/episodes', JSON.stringify([E1, E2])]);
    });

    it('says Applied with a Review action when everything succeeded', async () => {
      service.apply.mockReturnValue(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [{ resultId: A, state: 'Succeeded', attempts: 1, episodeId: E1 }] }));
      await create(detail());
      button('apply').click();
      await fixture.whenStable();
      expect(snackOpen).toHaveBeenCalledWith('Applied', 'Review', expect.anything());
    });

    it('offers only Ok when nothing was ingested', async () => {
      service.apply.mockReturnValue(of({ submissionId: 's1', status: 'ApplyFailed', itemOutcomes: [{ resultId: A, state: 'Failed', attempts: 1, error: 'x' }] }));
      await create(detail());
      button('apply').click();
      await fixture.whenStable();
      expect(snackOpen).toHaveBeenCalledWith(expect.any(String), 'Ok', expect.anything());
    });

    it('offers a Review action after Retry too', async () => {
      service.retry.mockReturnValue(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [{ resultId: B, state: 'Succeeded', attempts: 2, episodeId: E2 }] }));
      await create(detail({ status: 'PartiallyApplied', supervisorAcceptedResultIds: [B], itemOutcomes: [{ resultId: B, state: 'Failed', attempts: 1, error: 'x' }] }));
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button('retry').click();
      await fixture.whenStable();
      expect(snackOpen).toHaveBeenCalledWith('Retry: Applied', 'Review', expect.anything());
      snackAction.next();
      expect(navigate).toHaveBeenCalledWith(['/episodes', JSON.stringify([E2])]);
    });

    it('shows a lasting Review link on an applied submission', async () => {
      await create(detail({
        status: 'PartiallyApplied', itemOutcomes: [
          { resultId: A, state: 'Succeeded', attempts: 1, episodeId: E1 },
          { resultId: B, state: 'Succeeded', attempts: 1, episodeId: E2 },
          { resultId: C, state: 'Failed', attempts: 1, error: 'x' }
        ]
      }));
      expect(reviewLink()?.textContent).toContain('Review 2 ingested episodes');
      expect(decodeURIComponent(reviewLink()!.getAttribute('href')!)).toBe(`/episodes/${JSON.stringify([E1, E2])}`);
    });

    it('hides the Review link when nothing succeeded or the submission is not applied', async () => {
      await create(detail({ status: 'ApplyFailed', itemOutcomes: [{ resultId: A, state: 'Failed', attempts: 1, error: 'x' }] }));
      expect(reviewLink()).toBeNull();
      await create(detail({ status: 'Pending', itemOutcomes: [{ resultId: A, state: 'Succeeded', attempts: 1, episodeId: E1 }] }));
      expect(reviewLink()).toBeNull();
    });
  });

  describe('reviewing ingested episodes without the Curator role', () => {
    const E1 = 'eeeeeeee-0000-4000-8000-000000000001';

    it('gives a non-curator supervisor plain Ok after Apply (episodes page is Curator-only)', async () => {
      roles.next(['Supervisor']);
      service.apply.mockReturnValue(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [{ resultId: A, state: 'Succeeded', attempts: 1, episodeId: E1 }] }));
      await create(detail());
      button('apply').click();
      await fixture.whenStable();
      expect(snackOpen).toHaveBeenCalledWith('Applied', 'Ok', expect.anything());
    });

    it('gives a non-curator admin plain Ok after Retry', async () => {
      roles.next(['Admin']);
      service.retry.mockReturnValue(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [{ resultId: B, state: 'Succeeded', attempts: 2, episodeId: E1 }] }));
      await create(detail({ status: 'PartiallyApplied', supervisorAcceptedResultIds: [B], itemOutcomes: [{ resultId: B, state: 'Failed', attempts: 1, error: 'x' }] }));
      button('retry').click();
      await fixture.whenStable();
      expect(snackOpen).toHaveBeenCalledWith('Retry: Applied', 'Ok', expect.anything());
    });

    it('hides the lasting Review link from non-curators', async () => {
      roles.next(['Supervisor']);
      await create(detail({ status: 'Applied', itemOutcomes: [{ resultId: A, state: 'Succeeded', attempts: 1, episodeId: E1 }] }));
      expect(el().querySelector('a.review-ingested')).toBeNull();
    });
  });

  describe('redesigned layout', () => {
    it('shows friendly subject labels with the raw id only as a tooltip', async () => {
      await create(detail({ status: 'Applied', supervisorSubject: 'google-oauth2|117468924423760161962', appliedAt: '2026-10-12T21:58:00Z' }));
      const meta = el().querySelector('.submission-header__meta') as HTMLElement;
      expect(meta.textContent).not.toContain('google-oauth2|');
      expect(meta.textContent).toContain('Google user …1962');
      expect(meta.querySelector('.who[title="google-oauth2|117468924423760161962"]')).not.toBeNull();
    });

    it('hides zero-count pills', async () => {
      await create(detail());
      const pills = Array.from(el().querySelectorAll('.pick-legend')).map(p => p.getAttribute('data-pick'));
      expect(pills).toEqual(['kept', 'final']);
    });

    it('shows one compact chip per card and none for unpicked results', async () => {
      await create(detail({
        status: 'PartiallyApplied', supervisorAcceptedResultIds: [A, C],
        itemOutcomes: [
          { resultId: A, state: 'Succeeded', attempts: 1, episodeId: 'e1' },
          { resultId: C, state: 'Failed', attempts: 1, error: 'Timeout' }
        ]
      }));
      fixture.componentInstance['filter'].set('all');
      fixture.detectChanges();
      const chip = (id: string) => card(id).querySelector('.review-item__chip')?.textContent?.trim();
      expect(chip(A)).toBe('Kept · Created');
      expect(chip(B)).toBe('Removed');
      expect(chip(C)).toBe('Failed: Timeout');
      expect(card(A).querySelectorAll('.review-item__chip').length).toBe(1);
    });

    it('puts the Review button in the header and admin Change state in a collapsed panel after the results', async () => {
      roles.next(['Admin', 'Curator']);
      await create(detail({ status: 'Applied', itemOutcomes: [{ resultId: A, state: 'Succeeded', attempts: 1, episodeId: 'e1' }] }));
      expect(el().querySelector('.submission-header a.review-ingested')).not.toBeNull();
      const panel = el().querySelector('mat-expansion-panel.state-panel') as HTMLElement;
      expect(panel).not.toBeNull();
      expect(panel.classList.contains('mat-expanded')).toBe(false);
      const grid = el().querySelector('.curator-card-grid') as HTMLElement;
      expect(grid.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('inline episode editing', () => {
    const E1 = 'eeeeeeee-0000-4000-8000-000000000011';
    const E2 = 'eeeeeeee-0000-4000-8000-000000000012';
    const applied = () => detail({
      status: 'PartiallyApplied', itemOutcomes: [
        { resultId: A, state: 'Succeeded', attempts: 1, episodeId: E1 },
        { resultId: B, state: 'Failed', attempts: 1, error: 'x' },
        { resultId: C, state: 'Succeeded', attempts: 1, episodeId: E2 }
      ]
    });
    const embedded = () => el().querySelector('.ingested-episodes app-episodes-api');

    it('embeds the /episodes card list for the succeeded episodes, for curators', async () => {
      roles.next(['Curator', 'Supervisor']);
      await create(applied());
      expect(embedded()).not.toBeNull();
      expect(JSON.parse(el().querySelector('.stub-episodes')!.getAttribute('data-ids')!)).toEqual([E1, E2]);
      expect(el().querySelector('a.review-ingested')).not.toBeNull();
    });

    it('does not embed episode editing for non-curators', async () => {
      roles.next(['Supervisor']);
      await create(applied());
      expect(embedded()).toBeNull();
    });

    it('does not embed anything before apply', async () => {
      roles.next(['Curator', 'Supervisor']);
      await create(detail());
      expect(embedded()).toBeNull();
    });
  });

  describe('language and identity gates on apply/retry', () => {
    const languageHold = {
      discoveryItemId: A,
      code: 'is',
      name: 'Icelandic',
      signals: [{ field: 'episodeTitle', label: 'Episode title', excerpt: 'ekki', reason: 'Matched Icelandic words: ekki' }]
    };
    const identityHold = {
      discoveryItemId: B,
      target: 'Film',
      query: 'Synthetic Title',
      candidates: [
        { key: 'tmdb:11', title: 'Synthetic Title', year: 2020, kind: 'Film', source: 'tmdb', tmdbId: 11 }
      ]
    };

    it('re-posts apply with language decisions and filtered accepted ids after continue', async () => {
      service.apply
        .mockReturnValueOnce(of({
          submissionId: 's1', status: 'Pending', etag: 'e-lang',
          outcome: { message: 'LanguageDecisionRequired', errorsOccurred: false, results: [], languageDecisionsRequired: [languageHold] }
        }))
        .mockReturnValueOnce(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [] }));
      dialogOpen.mockReturnValue({ afterClosed: () => of('continue') });
      await create(detail());
      button('apply').click();
      await fixture.whenStable();
      expect(dialogOpen).toHaveBeenCalled();
      expect(service.apply).toHaveBeenNthCalledWith(2, 's1', 'e-lang', [B, A], {
        languageDecisions: { [A]: 'continue' }
      });
    });

    it('drops cancelled language ids from apply and does not re-post when nothing remains', async () => {
      service.apply.mockReturnValueOnce(of({
        submissionId: 's1', status: 'Pending', etag: 'e-lang',
        outcome: {
          message: 'LanguageDecisionRequired', errorsOccurred: false, results: [],
          languageDecisionsRequired: [
            languageHold,
            { ...languageHold, discoveryItemId: B }
          ]
        }
      }));
      dialogOpen.mockReturnValue({ afterClosed: () => of('cancel') });
      await create(detail({ submitterAcceptedResultIds: [A, B] }));
      button('apply').click();
      await fixture.whenStable();
      expect(service.apply).toHaveBeenCalledTimes(1);
      expect(snackOpen).toHaveBeenCalledWith('Nothing was created', 'Ok', expect.anything());
    });

    it('re-posts apply with identity decisions after select', async () => {
      service.apply
        .mockReturnValueOnce(of({
          submissionId: 's1', status: 'Pending', etag: 'e-id',
          outcome: { message: 'IdentityDecisionRequired', errorsOccurred: false, results: [], identityDecisionsRequired: [identityHold] }
        }))
        .mockReturnValueOnce(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [] }));
      dialogOpen.mockReturnValue({ afterClosed: () => of({ decision: 'select', key: 'tmdb:11' }) });
      await create(detail());
      button('apply').click();
      await fixture.whenStable();
      expect(service.apply).toHaveBeenNthCalledWith(2, 's1', 'e-id', [A, B], {
        identityDecisions: { [B]: 'select' },
        selectedIdentityKeys: { [B]: 'tmdb:11' }
      });
    });

    it('does not re-post apply when every identity prompt is cancelled', async () => {
      service.apply.mockReturnValueOnce(of({
        submissionId: 's1', status: 'Pending', etag: 'e-id',
        outcome: { message: 'IdentityDecisionRequired', errorsOccurred: false, results: [], identityDecisionsRequired: [identityHold] }
      }));
      dialogOpen.mockReturnValue({ afterClosed: () => of({ decision: 'cancel' }) });
      await create(detail({ submitterAcceptedResultIds: [B] }));
      button('apply').click();
      await fixture.whenStable();
      expect(service.apply).toHaveBeenCalledTimes(1);
      expect(snackOpen).toHaveBeenCalledWith('Nothing was created', 'Ok', expect.anything());
    });

    it('re-posts retry with identity decisions and abandons cancelled ids', async () => {
      service.retry
        .mockReturnValueOnce(of({
          submissionId: 's1', status: 'PartiallyApplied', etag: 'e-retry',
          outcome: {
            message: 'IdentityDecisionRequired', errorsOccurred: false, results: [],
            identityDecisionsRequired: [
              identityHold,
              { ...identityHold, discoveryItemId: C }
            ]
          }
        }))
        .mockReturnValueOnce(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [] }));
      let identityCalls = 0;
      dialogOpen.mockImplementation(() => {
        identityCalls += 1;
        return {
          afterClosed: () => of(
            identityCalls === 1
              ? { decision: 'select', key: 'tmdb:11' }
              : { decision: 'cancel' })
        };
      });
      await create(detail({
        status: 'PartiallyApplied', supervisorAcceptedResultIds: [B, C],
        itemOutcomes: [
          { resultId: B, state: 'Failed', attempts: 1, error: 'x' },
          { resultId: C, state: 'Failed', attempts: 1, error: 'y' }
        ]
      }));
      button('retry').click();
      await fixture.whenStable();
      expect(service.retry).toHaveBeenNthCalledWith(2, 's1', 'e-retry', [C], {
        identityDecisions: { [B]: 'select' },
        selectedIdentityKeys: { [B]: 'tmdb:11' }
      });
    });

    it('abandons cancelled ids on retry cancel-all without creating', async () => {
      service.retry
        .mockReturnValueOnce(of({
          submissionId: 's1', status: 'PartiallyApplied', etag: 'e-lang',
          outcome: { message: 'LanguageDecisionRequired', errorsOccurred: false, results: [], languageDecisionsRequired: [languageHold] }
        }))
        .mockReturnValueOnce(of({ submissionId: 's1', status: 'Applied', itemOutcomes: [] }));
      dialogOpen.mockReturnValue({ afterClosed: () => of('cancel') });
      await create(detail({
        status: 'PartiallyApplied', supervisorAcceptedResultIds: [A],
        itemOutcomes: [{ resultId: A, state: 'Failed', attempts: 1, error: 'x' }]
      }));
      button('retry').click();
      await fixture.whenStable();
      expect(service.retry).toHaveBeenCalledTimes(2);
      expect(service.retry).toHaveBeenNthCalledWith(2, 's1', 'e-lang', [A]);
      expect(snackOpen).toHaveBeenCalledWith('Nothing was created', 'Ok', expect.anything());
    });
  });
});
