import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpContext, HttpHeaders } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
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
        provideHttpClient(withInterceptors([authInterceptor])),
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
});
