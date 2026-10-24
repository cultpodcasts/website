import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AUTH_SCOPE } from '../auth.interceptor';
import { environment } from '../../environments/environment';
import { DiscoverySubmissionsService } from './discovery-submissions.service';

describe('DiscoverySubmissionsService', () => {
  let service: DiscoverySubmissionsService;
  let http: HttpTestingController;
  const api = (p: string) => new URL(p, environment.api).toString();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(DiscoverySubmissionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists with a supervision scope and tracks the supervisor badge count', () => {
    service.list().subscribe();
    const req = http.expectOne(api('/discovery-submissions'));
    expect(req.request.context.get(AUTH_SCOPE)).toContain('supervise');
    expect(req.request.context.get(AUTH_SCOPE)).toContain('curate:supervised');
    req.flush({ view: 'supervisor', pendingCount: 3, submissions: [] });
    expect(service.pendingCount()).toBe(3);
  });

  it('does not use a submitter list as the supervisor badge', () => {
    service.list().subscribe();
    http.expectOne(api('/discovery-submissions')).flush({ view: 'submitter', pendingCount: 5, submissions: [] });
    expect(service.pendingCount()).toBe(0);
  });

  it('sends review, apply, retry and release commands with the etag', () => {
    service.saveReview('s1', { etag: 'e', acceptedResultIds: ['a'], reportComment: 'ok' }).subscribe();
    const review = http.expectOne(api('/discovery-submissions/s1/review'));
    expect(review.request.method).toBe('PUT');
    expect(review.request.body).toEqual({ etag: 'e', acceptedResultIds: ['a'], reportComment: 'ok' });
    review.flush({});

    service.apply('s1', 'e', ['a', 'c']).subscribe();
    const apply = http.expectOne(api('/discovery-submissions/s1/apply'));
    expect(apply.request.body).toEqual({ etag: 'e', acceptedResultIds: ['a', 'c'] });
    apply.flush({});

    service.apply('s1', 'e', ['a'], {
      languageDecisions: { a: 'continue' },
      identityDecisions: { a: 'select' },
      selectedIdentityKeys: { a: 'tmdb:11' }
    }).subscribe();
    const applyDecisions = http.expectOne(api('/discovery-submissions/s1/apply'));
    expect(applyDecisions.request.body).toEqual({
      etag: 'e',
      acceptedResultIds: ['a'],
      languageDecisions: { a: 'continue' },
      identityDecisions: { a: 'select' },
      selectedIdentityKeys: { a: 'tmdb:11' }
    });
    applyDecisions.flush({});

    service.retry('s1', 'e', ['x']).subscribe();
    const retry = http.expectOne(api('/discovery-submissions/s1/retry'));
    expect(retry.request.body).toEqual({ etag: 'e', abandonResultIds: ['x'] });
    retry.flush({});

    service.retry('s1', 'e', ['x'], {
      identityDecisions: { y: 'continue' }
    }).subscribe();
    const retryIdentity = http.expectOne(api('/discovery-submissions/s1/retry'));
    expect(retryIdentity.request.body).toEqual({
      etag: 'e',
      abandonResultIds: ['x'],
      identityDecisions: { y: 'continue' }
    });
    retryIdentity.flush({});

    service.release('s1', 'e', '  wrong batch ').subscribe();
    const release = http.expectOne(api('/discovery-submissions/s1/release'));
    expect(release.request.body).toEqual({ etag: 'e', reason: 'wrong batch' });
    release.flush({});

    service.changeState('s1', 'Pending', 'e', ' crashed ').subscribe();
    const state = http.expectOne(api('/discovery-submissions/s1/state'));
    expect(state.request.context.get(AUTH_SCOPE)).toBe('admin');
    expect(state.request.body).toEqual({ status: 'Pending', etag: 'e', reason: 'crashed' });
    state.flush({});

    service.releaseReport('d1').subscribe();
    const admin = http.expectOne(api('/discovery-reports/d1/release'));
    expect(admin.request.context.get(AUTH_SCOPE)).toBe('admin');
    expect(admin.request.body).toEqual({ reason: null });
    admin.flush({});
  });
});
