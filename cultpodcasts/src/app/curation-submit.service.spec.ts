import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { of } from 'rxjs';
import { environment } from '../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { CurationSubmitService } from './curation-submit.service';

describe('CurationSubmitService', () => {
  let service: CurationSubmitService;
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
        CurationSubmitService
      ]
    });
    service = TestBed.inject(CurationSubmitService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POSTs /podcast/{id}/kind body { targetKind } with curate interceptor', async () => {
    const podcastId = 'Show A';
    const pending = firstValueFrom(service.postPodcastKind(podcastId, CatalogueParentKind.TvShow));
    const expected = new URL('/podcast/' + encodeURIComponent(podcastId) + '/kind', environment.api).toString();
    const req = httpMock.expectOne(expected);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetKind: CatalogueParentKind.TvShow });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ parentId: 'parent-1', targetKind: CatalogueParentKind.TvShow }, { status: 202, statusText: 'Accepted' });
    const resp = await pending;
    expect(resp.status).toBe(202);
    expect(resp.body?.parentId).toBe('parent-1');
  });
});
