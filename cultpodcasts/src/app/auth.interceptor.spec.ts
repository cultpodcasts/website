import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpContext, HttpHeaders } from '@angular/common/http';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let getAccessTokenSilently: jasmine.Spy;
  const api = environment.api.replace(/\/$/, '');

  function setup(platformId: object = 'browser' as unknown as object) {
    getAccessTokenSilently = jasmine.createSpy('getAccessTokenSilently').and.returnValue(of('test-token'));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platformId },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: { getAccessTokenSilently }
          }
        }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches Bearer token for API requests using AUTH_SCOPE from context', () => {
    setup();
    const context = new HttpContext().set(AUTH_SCOPE, 'curate');
    http.get(`${api}/episode/1`, { context }).subscribe();

    const req = httpMock.expectOne(`${api}/episode/1`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(getAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: {
        audience: 'https://api.cultpodcasts.com/',
        scope: 'curate'
      }
    });
    req.flush({});
  });

  it('passes through public API requests when AUTH_SCOPE is unset', () => {
    setup();
    http.get(`${api}/homepage`).subscribe();

    const req = httpMock.expectOne(`${api}/homepage`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(getAccessTokenSilently).not.toHaveBeenCalled();
    req.flush({});
  });

  it('passes through non-API requests unchanged', () => {
    setup();
    http.get('https://example.com/asset.json').subscribe();

    const req = httpMock.expectOne('https://example.com/asset.json');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(getAccessTokenSilently).not.toHaveBeenCalled();
    req.flush({});
  });

  it('skips token fetch when Authorization is already set', () => {
    setup();
    const headers = new HttpHeaders().set('Authorization', 'Bearer existing');
    http.get(`${api}/episode/1`, { headers }).subscribe();

    const req = httpMock.expectOne(`${api}/episode/1`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer existing');
    expect(getAccessTokenSilently).not.toHaveBeenCalled();
    req.flush({});
  });

  it('skips token fetch outside the browser', () => {
    setup('server' as unknown as object);
    http.get(`${api}/episode/1`).subscribe();

    const req = httpMock.expectOne(`${api}/episode/1`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(getAccessTokenSilently).not.toHaveBeenCalled();
    req.flush({});
  });

  it('propagates API error responses without retrying unauthenticated', () => {
    setup();
    const context = new HttpContext().set(AUTH_SCOPE, 'curate');
    let status: number | undefined;
    let errorBody: unknown;
    http.post(`${api}/episode/publish/p/e`, { tweet: true }, { context }).subscribe({
      error: (err) => {
        status = err.status;
        errorBody = err.error;
      }
    });

    const req = httpMock.expectOne(`${api}/episode/publish/p/e`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush(
      { tweeted: false, failedTweetContent: 'hello tweet' },
      { status: 400, statusText: 'Bad Request' }
    );

    httpMock.expectNone(`${api}/episode/publish/p/e`);
    expect(status).toBe(400);
    expect(errorBody).toEqual({ tweeted: false, failedTweetContent: 'hello tweet' });
  });

  it('continues without token when silent auth fails', () => {
    setup();
    getAccessTokenSilently.and.returnValue(throwError(() => new Error('login_required')));

    const context = new HttpContext().set(AUTH_SCOPE, 'curate');
    http.get(`${api}/episode/1`, { context }).subscribe();

    const req = httpMock.expectOne(`${api}/episode/1`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
