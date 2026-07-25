import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { environment } from '../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { HeroCurationService } from './hero-curation.service';
import { of } from 'rxjs';

describe('HeroCurationService', () => {
  let service: HeroCurationService;
  let httpMock: HttpTestingController;
  const url = new URL('/hero-curation', environment.api).toString();

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
              getAccessTokenSilently: () => of('test-token'),
            },
          },
        },
        HeroCurationService,
      ],
    });
    service = TestBed.inject(HeroCurationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('normalizes missing arrays on GET success', async () => {
    const pending = service.getHeroCuration();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush({});

    await expect(pending).resolves.toEqual({
      episodeIds: [],
      railSubjects: [],
      updatedAt: null,
    });
  });

  it('returns empty lists when GET fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pending = service.getHeroCuration();
    httpMock.expectOne(url).error(new ProgressEvent('error'));

    await expect(pending).resolves.toEqual({
      episodeIds: [],
      railSubjects: [],
      updatedAt: null,
    });
    warn.mockRestore();
  });

  it('PUTs with curate scope and normalizes the response', async () => {
    const pending = service.setHomepageCuration({
      episodeIds: ['a'],
      railSubjects: ['Cult'],
    });
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ episodeIds: ['a'], railSubjects: ['Cult'] });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ episodeIds: ['a'], railSubjects: ['Cult'], updatedAt: '2026-01-01' });

    await expect(pending).resolves.toEqual({
      episodeIds: ['a'],
      railSubjects: ['Cult'],
      updatedAt: '2026-01-01',
    });
  });

  it('setHeroCuration / setRailSubjects send partial bodies', async () => {
    const hero = service.setHeroCuration(['e1']);
    const heroReq = httpMock.expectOne(url);
    expect(heroReq.request.body).toEqual({ episodeIds: ['e1'] });
    heroReq.flush({ episodeIds: ['e1'], railSubjects: [] });
    await hero;

    const rails = service.setRailSubjects(['Scientology']);
    const railsReq = httpMock.expectOne(url);
    expect(railsReq.request.body).toEqual({ railSubjects: ['Scientology'] });
    railsReq.flush({ episodeIds: [], railSubjects: ['Scientology'] });
    await rails;
  });

  it('rethrows when PUT fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = service.setHeroCuration(['e1']);
    httpMock.expectOne(url).flush('nope', { status: 500, statusText: 'Server Error' });
    await expect(pending).rejects.toBeTruthy();
    err.mockRestore();
  });
});
