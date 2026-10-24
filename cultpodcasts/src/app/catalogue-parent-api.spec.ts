import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { CurationSubmitService } from './curation-submit.service';
import { SubmitSeriesResolveService } from './submit-series-resolve.service';

const parentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const otherId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('news outlet / TV show API calls', () => {
  let curation: CurationSubmitService;
  let resolve: SubmitSeriesResolveService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    });
    curation = TestBed.inject(CurationSubmitService);
    resolve = TestBed.inject(SubmitSeriesResolveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const url = (path: string) => new URL(path, environment.api).toString();

  describe('probeParentByName', () => {
    it('GETs /newsorganisation/{name} with curate scope and returns the id', async () => {
      const pending = resolve.probeParentByName('news', 'Desk One');
      const req = httpMock.expectOne(url('/newsorganisation/Desk%20One'));
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
      req.flush({ id: parentId, name: 'Desk One' });
      await expect(pending).resolves.toEqual({ kind: 'unique', id: parentId, name: 'Desk One' });
    });

    it('uses /tvshow/ for TV, maps 404 to missing', async () => {
      const pending = resolve.probeParentByName('tv', 'Nightly');
      httpMock.expectOne(url('/tvshow/Nightly')).flush(null, { status: 404, statusText: 'Not Found' });
      await expect(pending).resolves.toEqual({ kind: 'missing' });
    });

    it('maps a 409 guid array to conflict', async () => {
      const pending = resolve.probeParentByName('news', 'Desk');
      httpMock.expectOne(url('/newsorganisation/Desk')).flush([parentId, otherId], { status: 409, statusText: 'Conflict' });
      await expect(pending).resolves.toEqual({ kind: 'conflict', ids: [parentId, otherId] });
    });

    it('maps other failures, a 200 without id, and a blank name to error', async () => {
      await expect(resolve.probeParentByName('news', '  ')).resolves.toEqual({ kind: 'error' });
      const failed = resolve.probeParentByName('news', 'Desk');
      httpMock.expectOne(url('/newsorganisation/Desk')).flush('No item found', { status: 400, statusText: 'Bad Request' });
      await expect(failed).resolves.toEqual({ kind: 'error' });
      const noId = resolve.probeParentByName('tv', 'Nightly');
      httpMock.expectOne(url('/tvshow/Nightly')).flush({});
      await expect(noId).resolves.toEqual({ kind: 'error' });
    });
  });

  describe('CurationSubmitService parent calls', () => {
    it('GETs a parent by route-form name (curate)', async () => {
      const pending = firstValueFrom(curation.getCatalogueParent('tv', 'Night Show'));
      const req = httpMock.expectOne(url('/tvshow/Night%20Show'));
      expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
      req.flush({ id: parentId, name: 'Night Show' });
      await expect(pending).resolves.toEqual({ id: parentId, name: 'Night Show' });
    });

    it('encodes a slash in the news outlet name as %2F so GET keeps one path segment', async () => {
      const name = 'Synthetic Desk 24/7';
      const pending = firstValueFrom(curation.getCatalogueParent('news', name));
      const req = httpMock.expectOne(url(`/newsorganisation/${encodeURIComponent(name)}`));
      expect(req.request.method).toBe('GET');
      expect(req.request.url).toContain('24%2F7');
      expect(req.request.url).not.toMatch(/newsorganisation\/.*24\/7/);
      req.flush({ id: parentId, name });
      await expect(pending).resolves.toEqual({ id: parentId, name });
    });

    it('PATCHes by guid with only the changes (curate) and accepts 202', async () => {
      const pending = firstValueFrom(curation.patchCatalogueParent('news', parentId, { twitterHandle: '' }));
      const req = httpMock.expectOne(url(`/newsorganisation/${parentId}`));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ twitterHandle: '' });
      expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
      req.flush(null, { status: 202, statusText: 'Accepted' });
      expect((await pending).status).toBe(202);
    });

    it('POSTs the admin rename to /{root}/name/{identifier} with { newName }', async () => {
      const pending = firstValueFrom(curation.renameCatalogueParent('news', 'Old Desk', 'New Desk'));
      const req = httpMock.expectOne(url('/newsorganisation/name/Old%20Desk'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ newName: 'New Desk' });
      expect(req.request.context.get(AUTH_SCOPE)).toBe('admin');
      req.flush({ indexState: 'Executed' });
      expect((await pending).body).toEqual({ indexState: 'Executed' });
    });
  });
});
