import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { environment } from './../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { SubmitUrlLookupService } from './submit-url-lookup.service';

describe('SubmitUrlLookupService', () => {
  let service: SubmitUrlLookupService;
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
        SubmitUrlLookupService
      ]
    });
    service = TestBed.inject(SubmitUrlLookupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs /submit/lookup with the encoded url and submit scope', async () => {
    const url = 'https://www.bbc.co.uk/sounds/play/p0example';
    const pending = service.lookup(url);
    const expected = new URL('/submit/lookup', environment.api);
    expected.searchParams.set('url', url);
    const req = httpMock.expectOne(expected.toString());
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(AUTH_SCOPE)).toBe('submit');
    req.flush({ known: false, kind: 'streaming' });
    await expect(pending).resolves.toEqual({ known: false, kind: 'streaming' });
  });
});
