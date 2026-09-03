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

  it('GETs /submit/lookup with the encoded url and curate scope, because only Curator may call Azure lookup', async () => {
    const url = 'https://www.bbc.co.uk/sounds/play/p0example';
    const pending = service.lookup(url);
    const expected = new URL('/submit/lookup', environment.api);
    expected.searchParams.set('url', url);
    const req = httpMock.expectOne(expected.toString());
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ known: false, kind: 'streaming', podcastName: 'Extracted Show' });
    await expect(pending).resolves.toEqual({
      known: false,
      kind: 'streaming',
      podcastName: 'Extracted Show'
    });
  });

  it('accepts unique known membership with podcastId and podcastName', async () => {
    const url = 'https://open.spotify.com/episode/0exampleepisode00';
    const pending = service.lookup(url);
    const expected = new URL('/submit/lookup', environment.api);
    expected.searchParams.set('url', url);
    const req = httpMock.expectOne(expected.toString());
    const body = {
      known: true as const,
      podcastId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      podcastName: 'Stored Show Name'
    };
    req.flush(body);
    await expect(pending).resolves.toEqual(body);
  });

  it('accepts ambiguous 200 with a podcastIds UUID list', async () => {
    const url = 'https://www.netflix.com/watch/80057281';
    const pending = service.lookup(url);
    const expected = new URL('/submit/lookup', environment.api);
    expected.searchParams.set('url', url);
    const req = httpMock.expectOne(expected.toString());
    const body = {
      known: false as const,
      ambiguous: true as const,
      podcastIds: [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      ]
    };
    req.flush(body);
    await expect(pending).resolves.toEqual(body);
  });
});
