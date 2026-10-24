import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoveryInfoService } from '../discovery-info.service';
import { environment } from '../../environments/environment';
import { DiscoverySubmitComponent } from './discovery-submit.component';

describe('DiscoverySubmitComponent supervised submits', () => {
  let http: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let getToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    close = vi.fn();
    getToken = vi.fn().mockReturnValue(of('token'));
    TestBed.configureTestingModule({
      imports: [DiscoverySubmitComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: getToken } } },
        { provide: DiscoveryInfoService, useValue: { getDiscoveryInfo: vi.fn() } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  function create(answer: 'add' | 'continue' | 'cancel' = 'cancel') {
    const fixture = TestBed.createComponent(DiscoverySubmitComponent);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    const openDialog = vi.spyOn(dialog, 'open').mockReturnValue({ afterClosed: () => of(answer) } as never);
    return { component: fixture.componentInstance, openDialog };
  }

  async function submit(flush: (req: ReturnType<HttpTestingController['expectOne']>) => void) {
    const { component } = create();
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1'] });
    const req = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    flush(req);
    await done;
    return component;
  }

  it('requests curate:supervised so a supervised user\'s token is recognised', async () => {
    await submit(req => req.flush({ submissionId: 's1', status: 'Pending' }, { status: 202, statusText: 'Accepted' }));
    expect(getToken.mock.calls[0][0].authorizationParams.scope).toContain('curate:supervised');
  });

  it('closes with the held submission id on 202 instead of an ingest outcome', async () => {
    await submit(req => req.flush({ submissionId: 's1', status: 'Pending' }, { status: 202, statusText: 'Accepted' }));
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ heldSubmissionId: 's1', endpointError: false }));
  });

  it('explains a 409 instead of a generic error', async () => {
    const component = await submit(req => req.flush(
      { message: 'Reports already awaiting review', documentIds: ['d1'] }, { status: 409, statusText: 'Conflict' }));
    expect(component.submitState().endpointError).toBe(true);
    expect(component.submitState().errorMessage).toContain('Reports already awaiting review');
    expect(close).not.toHaveBeenCalled();
  });

  it('reconciles durable stamps after a Worker 500 so the curator sees what landed', async () => {
    const { component } = create();
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1', 'r2'] });
    const req = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    req.flush({ error: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
    const outcome = await vi.waitFor(() =>
      http.expectOne(new URL('/discovery-curation/submit-outcome', environment.api).toString()));
    expect(outcome.request.body).toEqual({ ids: ['d1'], resultIds: ['r1', 'r2'] });
    outcome.flush({
      results: [
        {
          discoveryItemId: 'r1',
          state: 'Accepted',
          podcastId: 'p1',
          episodeId: 'e1',
          episodeName: 'Korean episode',
          showName: 'Bible Fact'
        },
        { discoveryItemId: 'r2', state: 'Pending', episodeName: 'Still pending' }
      ]
    });
    await done;
    expect(component.submitState().reconciledOutcomes?.length).toBe(2);
    expect(component.reconciledSubmitted().map(x => x.discoveryItemId)).toEqual(['r1']);
    expect(component.reconciledPending().map(x => x.discoveryItemId)).toEqual(['r2']);
    expect(component.submitState().episodeIds).toEqual(['p1/e1']);
    expect(close).not.toHaveBeenCalled();
  });

  it('shows reconcile UI when every stamp is still Pending after a Worker 500', async () => {
    const { component } = create();
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1', 'r2'] });
    const req = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    req.flush({ error: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
    const outcome = await vi.waitFor(() =>
      http.expectOne(new URL('/discovery-curation/submit-outcome', environment.api).toString()));
    outcome.flush({
      results: [
        { discoveryItemId: 'r1', state: 'Pending', episodeName: 'One' },
        { discoveryItemId: 'r2', state: 'Pending', episodeName: 'Two' }
      ]
    });
    await done;
    expect(component.submitState().reconciledOutcomes?.length).toBe(2);
    expect(component.reconciledSubmitted()).toEqual([]);
    expect(component.reconciledPending().map(x => x.discoveryItemId)).toEqual(['r1', 'r2']);
    expect(component.reconciledRejected()).toEqual([]);
    expect(close).not.toHaveBeenCalled();
  });

  it('buckets Rejected separately from Still pending', async () => {
    const { component } = create();
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1', 'r2'] });
    const req = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    req.flush({ error: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
    const outcome = await vi.waitFor(() =>
      http.expectOne(new URL('/discovery-curation/submit-outcome', environment.api).toString()));
    outcome.flush({
      results: [
        { discoveryItemId: 'r1', state: 'Rejected', episodeName: 'No' },
        { discoveryItemId: 'r2', state: 'Unknown', episodeName: 'Maybe' }
      ]
    });
    await done;
    expect(component.reconciledRejected().map(x => x.discoveryItemId)).toEqual(['r1']);
    expect(component.reconciledPending().map(x => x.discoveryItemId)).toEqual(['r2']);
  });

  it('does not call submit-outcome after a definitive 4xx', async () => {
    await submit(req => req.flush(
      { message: 'Reports already awaiting review', documentIds: ['d1'] }, { status: 409, statusText: 'Conflict' }));
    http.expectNone(new URL('/discovery-curation/submit-outcome', environment.api).toString());
  });

  it('asks about an unsupported language before the creating post', async () => {
    const { component, openDialog } = create('continue');
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1'] });
    const probe = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    expect(openDialog).not.toHaveBeenCalled();
    probe.flush({
      message: 'LanguageDecisionRequired',
      errorsOccurred: false,
      results: [],
      languageDecisionsRequired: [{
        discoveryItemId: 'r1',
        code: 'is',
        name: 'Icelandic',
        signals: [{ field: 'episodeTitle', label: 'Episode title', excerpt: 'ekki', reason: 'Matched Icelandic words: ekki' }]
      }]
    });
    await vi.waitFor(() => expect(openDialog).toHaveBeenCalled());
    const creating = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    expect(creating.request.body).toEqual({
      ids: ['d1'],
      resultIds: ['r1'],
      languageDecisions: { r1: 'continue' }
    });
    creating.flush({ message: 'Success', errorsOccurred: false, results: [] });
    await done;
    expect(component.submitState().endpointError).toBe(false);
  });

  it('does not post a create when the unsupported-language prompt is cancelled', async () => {
    const { component } = create('cancel');
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1'] });
    const probe = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    probe.flush({
      message: 'LanguageDecisionRequired',
      errorsOccurred: false,
      results: [],
      languageDecisionsRequired: [{
        discoveryItemId: 'r1',
        code: 'is',
        name: 'Icelandic',
        signals: [{ field: 'episodeTitle', label: 'Episode title', excerpt: 'ekki', reason: 'Matched Icelandic words: ekki' }]
      }]
    });
    await done;
    http.expectNone(new URL('/discovery-curation', environment.api).toString());
    expect(close).not.toHaveBeenCalled();
  });

  it('asks about ambiguous identity before the creating post', async () => {
    const fixture = TestBed.createComponent(DiscoverySubmitComponent);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    const openDialog = vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of({ decision: 'select', key: 'tmdb:11' })
    } as never);
    const component = fixture.componentInstance;
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1'] });
    const probe = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    expect(openDialog).not.toHaveBeenCalled();
    probe.flush({
      message: 'IdentityDecisionRequired',
      errorsOccurred: false,
      results: [],
      identityDecisionsRequired: [{
        discoveryItemId: 'r1',
        target: 'Film',
        query: 'Synthetic Title',
        candidates: [
          { key: 'tmdb:11', title: 'Synthetic Title', year: 2020, kind: 'Film', source: 'tmdb', tmdbId: 11 }
        ]
      }]
    });
    await vi.waitFor(() => expect(openDialog).toHaveBeenCalled());
    const creating = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    expect(creating.request.body).toEqual({
      ids: ['d1'],
      resultIds: ['r1'],
      identityDecisions: { r1: 'select' },
      selectedIdentityKeys: { r1: 'tmdb:11' }
    });
    creating.flush({ message: 'Success', errorsOccurred: false, results: [] });
    await done;
    expect(component.submitState().endpointError).toBe(false);
  });
});
