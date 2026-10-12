import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, throwError } from 'rxjs';
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

describe('DiscoverySubmissionDetailComponent', () => {
  let fixture: ComponentFixture<DiscoverySubmissionDetailComponent>;
  let service: {
    get: ReturnType<typeof vi.fn>; saveReview: ReturnType<typeof vi.fn>; apply: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn>; changeState: ReturnType<typeof vi.fn>;
  };
  let dialogOpen: ReturnType<typeof vi.fn>;
  let roles: BehaviorSubject<string[]>;

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
        { provide: MatSnackBar, useValue: { open: vi.fn() } }
      ]
    }).compileComponents();
  });

  it('shows every held result with the submitter picks marked and subject-match tooltips intact', async () => {
    await create(detail());
    expect(card(A).dataset['pick']).toBe('kept');
    expect(card(B).dataset['pick']).toBe('kept');
    expect(card(C).dataset['pick']).toBe('none');
    expect(card(A).querySelector('.mat-mdc-tooltip-trigger')).not.toBeNull();
  });

  it('lets the supervisor add a missed result and remove a wrong one, then apply the reworked set with comments', async () => {
    await create(detail());
    (card(C).querySelector('mat-card') as HTMLElement).click();
    (card(A).querySelector('mat-card') as HTMLElement).click();
    fixture.detectChanges();
    expect(card(C).dataset['pick']).toBe('added');
    expect(card(A).dataset['pick']).toBe('removed');
    expect(el().textContent).toContain('+1 added');
    expect(el().textContent).toContain('−1 removed');

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
    (card(C).querySelector('mat-card') as HTMLElement).click();
    fixture.detectChanges();
    button('apply').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('[role=alert]')?.textContent).toContain('Report changed');
    expect(card(C).dataset['pick']).toBe('added');
  });
});
