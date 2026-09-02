import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { environment } from './../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { Podcast } from './podcast.interface';
import { SubmitSeriesResolveService } from './submit-series-resolve.service';

const uniqueId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const firstConflictId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondConflictId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function cataloguePodcast(id: string, name: string, extras: Partial<Podcast> = {}): Podcast {
  return {
    id,
    name,
    removed: false,
    indexAllEpisodes: false,
    bypassShortEpisodeChecking: false,
    alwaysPromoteAsHero: false,
    spotifyId: extras.spotifyId ?? '',
    appleId: extras.appleId ?? null,
    youTubePublicationDelay: '',
    skipEnrichingFromYouTube: false,
    twitterHandle: '',
    blueskyHandle: '',
    titleRegex: '',
    descriptionRegex: '',
    episodeMatchRegex: '',
    episodeIncludeTitleRegex: '',
    defaultSubject: null,
    ignoreAllEpisodes: false,
    youTubeChannelId: extras.youTubeChannelId ?? '',
    youTubePlaylistId: extras.youTubePlaylistId ?? '',
    ignoredAssociatedSubjects: [],
    ignoredSubjects: [],
    lang: 'en',
    knownTerms: [],
    minimumDuration: '',
    enrichmentHashTags: null,
    hashTag: null,
    ...extras
  };
}

describe('SubmitSeriesResolveService', () => {
  let service: SubmitSeriesResolveService;
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
        SubmitSeriesResolveService
      ]
    });
    service = TestBed.inject(SubmitSeriesResolveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('treats 200 as a unique series and uses curate scope', async () => {
    const name = 'Shared Catalogue Title';
    const podcast = cataloguePodcast(uniqueId, name, { spotifyId: 'show-alpha' });
    const pending = service.probeByName(name);
    const req = httpMock.expectOne(new URL(`/podcast/${encodeURIComponent(name)}`, environment.api).toString());
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush(podcast);

    await expect(pending).resolves.toEqual({ kind: 'unique', podcast });
  });

  it('treats 404 as a missing series so submit can create by name', async () => {
    const name = 'Brand New Series';
    const pending = service.probeByName(name);
    httpMock.expectOne(new URL(`/podcast/${encodeURIComponent(name)}`, environment.api).toString())
      .flush({ error: 'Unable to retrieve podcast' }, { status: 404, statusText: 'Not Found' });

    await expect(pending).resolves.toEqual({ kind: 'missing' });
  });

    it('on 409 loads each UUID so the curator can pick by catalogue details', async () => {
        const name = 'Duplicate Series Title';
        const first = cataloguePodcast(firstConflictId, name, { spotifyId: 'show-one', removed: true });
        const second = cataloguePodcast(secondConflictId, name, { appleId: 9990001112223 });
        const pending = service.probeByName(name);

        httpMock.expectOne(new URL(`/podcast/${encodeURIComponent(name)}`, environment.api).toString())
            .flush([firstConflictId, secondConflictId], { status: 409, statusText: 'Conflict' });

        const byIdBodies = new Map<string, Podcast>([
            [firstConflictId, first],
            [secondConflictId, second]
        ]);
        for (let i = 0; i < 8 && byIdBodies.size > 0; i++) {
            await Promise.resolve();
            const outstanding = httpMock.match(req =>
                [...byIdBodies.keys()].some(id => req.url.endsWith(`/podcast/${id}`)));
            for (const req of outstanding) {
                expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
                const id = [...byIdBodies.keys()].find(key => req.request.url.endsWith(`/podcast/${key}`));
                if (id) {
                    req.flush(byIdBodies.get(id)!);
                    byIdBodies.delete(id);
                }
            }
        }

        await expect(pending).resolves.toEqual({
            kind: 'conflict',
            ids: [firstConflictId, secondConflictId],
            podcasts: [first, second]
        });
    });
});
