import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { environment } from './../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { SubmitUrlPrepareService } from './submit-url-prepare.service';

describe('SubmitUrlPrepareService', () => {
  let service: SubmitUrlPrepareService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: {
              getAccessTokenSilently: () => of('test-token')
            }
          }
        },
        SubmitUrlPrepareService
      ]
    });
    service = TestBed.inject(SubmitUrlPrepareService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs /submit/prepare with url and submit scope', async () => {
    const url = 'https://www.itv.com/watch/example-slug/1a2345/1a2345a0001';
    const pending = service.prepare(url);
    const expected = new URL('/submit/prepare', environment.api);
    const req = httpMock.expectOne(expected.toString());
    expect(req.request.method).toBe('POST');
    expect(req.request.context.get(AUTH_SCOPE)).toBe('submit');
    expect(req.request.body).toEqual({ url });
    const body = {
      service: 'itvx' as const,
      htmlFetchMode: 'browserRendering' as const,
      podcastName: 'Extracted Show',
      title: 'Extracted Show'
    };
    req.flush(body);
    await expect(pending).resolves.toEqual(body);
  });
});
