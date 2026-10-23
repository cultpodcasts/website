import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { DiscoveryBanService } from './discovery-ban.service';
import { banFailureMessage, bannedResultIds, isSameBannedChannel } from './discovery-ban';
import { DiscoveryResult } from './discovery-result.interface';

describe('discovery channel ban', () => {
  const api = (path: string) => new URL(path, environment.api).toString();

  function card(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
    return {
      id: 'b6f1c2d4-0000-4000-8000-000000000001',
      urls: { spotify: undefined, apple: undefined, youtube: undefined },
      episodeName: 'Evening briefing',
      showName: 'Northwind Briefing',
      episodeDescription: 'A synthetic episode',
      showDescription: undefined,
      released: new Date('2026-10-01T10:00:00Z'),
      duration: undefined,
      subjects: [],
      youTubeViews: undefined,
      youTubeChannelMembers: undefined,
      containsSyntheticMedia: undefined,
      guests: undefined,
      imageUrl: undefined,
      enrichedTimeFromApple: false,
      enrichedUrlFromSpotify: false,
      matchingPodcasts: null,
      acceptProbability: null,
      autoHidden: false,
      isFocused: undefined,
      ...overrides
    };
  }

  it('treats the banned card, the same show name, and the same channel id as one podcast', () => {
    const source = card();
    const sibling = card({
      id: 'b6f1c2d4-0000-4000-8000-000000000002',
      episodeName: 'Morning briefing'
    });
    const other = card({
      id: 'b6f1c2d4-0000-4000-8000-000000000003',
      showName: 'Harbour Notes',
      youTubeChannelId: 'UCotherchannel0000000001'
    });
    const sameChannel = card({
      id: 'b6f1c2d4-0000-4000-8000-000000000004',
      showName: 'Harbour Notes',
      youTubeChannelId: 'UCbannedchannel000000001'
    });
    const sameNameOtherChannel = card({
      id: 'b6f1c2d4-0000-4000-8000-000000000005',
      showName: 'Northwind Briefing',
      youTubeChannelId: 'UCotherchannel0000000001'
    });
    const banned = {
      resultId: source.id,
      showName: source.showName,
      youTubeChannelId: 'UCbannedchannel000000001',
      podcastId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    };

    expect(isSameBannedChannel(source, banned)).toBe(true);
    expect(isSameBannedChannel(sibling, banned)).toBe(true);
    expect(isSameBannedChannel(sameChannel, banned)).toBe(true);
    expect(isSameBannedChannel(other, banned)).toBe(false);
    expect(isSameBannedChannel(sameNameOtherChannel, banned)).toBe(false);
    expect(bannedResultIds([source, sibling, other, sameChannel, sameNameOtherChannel], banned)).toEqual([
      source.id,
      sibling.id,
      sameChannel.id
    ]);
  });

  it('reads a refusal from a text body and a follow-up Error message', () => {
    const refused = {
      message: 'Http failure response for https://127.0.0.1:8787/discovery-curation/x/ban: 409 Conflict',
      error: JSON.stringify({ error: 'More than one podcast matches this channel.' })
    };
    const parsedGet = { error: { error: 'Unable to remove the podcast.' } };

    expect(banFailureMessage(refused)).toBe('More than one podcast matches this channel.');
    expect(banFailureMessage(parsedGet)).toBe('Unable to remove the podcast.');
    expect(banFailureMessage(new Error('Podcast was not removed.'))).toBe('Podcast was not removed.');
  });

  it('posts the ban, then GETs discovery and the podcast before treating the channel as removed', async () => {
    const resultId = 'b6f1c2d4-0000-4000-8000-000000000001';
    const podcastId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthServiceWrapper,
          useValue: { authService: { getAccessTokenSilently: () => of('token') } }
        }
      ]
    });
    const service = TestBed.inject(DiscoveryBanService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.ban(resultId);
    await Promise.resolve();
    await Promise.resolve();
    const post = http.expectOne(api(`/discovery-curation/${resultId}/ban`));
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Authorization')).toBe('Bearer token');
    post.flush('', { status: 202, statusText: 'Accepted' });

    await Promise.resolve();
    const discovery = http.expectOne(api('/discovery-curation'));
    expect(discovery.request.method).toBe('GET');
    discovery.flush({
      ids: [],
      hiddenCount: 0,
      results: [{
        id: resultId,
        urls: {},
        showName: 'Northwind Briefing',
        released: '2026-10-01T10:00:00Z',
        subjects: [],
        enrichedTimeFromApple: false,
        enrichedUrlFromSpotify: false,
        autoHidden: false,
        matchingPodcasts: [{ id: podcastId, name: 'Northwind Briefing', visible: false, visibleEpisodes: 0 }]
      }]
    });

    await Promise.resolve();
    const podcast = http.expectOne(api(`/podcast/${podcastId}`));
    expect(podcast.request.method).toBe('GET');
    podcast.flush({
      id: podcastId,
      name: 'Northwind Briefing',
      removed: true,
      youTubeChannelId: 'UCbannedchannel000000001'
    });

    const read = await pending;
    expect(read.podcast.removed).toBe(true);
    expect(read.podcast.id).toBe(podcastId);
    expect(read.discovery.results[0].matchingPodcasts?.[0].visible).toBe(false);
    http.verify();
  });

  it('binds the removed podcast when an earlier match is still visible', async () => {
    const resultId = 'b6f1c2d4-0000-4000-8000-000000000001';
    const stillThereId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01';
    const removedId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02';
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthServiceWrapper,
          useValue: { authService: { getAccessTokenSilently: () => of('token') } }
        }
      ]
    });
    const service = TestBed.inject(DiscoveryBanService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.ban(resultId);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(api(`/discovery-curation/${resultId}/ban`))
      .flush('', { status: 202, statusText: 'Accepted' });

    await Promise.resolve();
    http.expectOne(api('/discovery-curation')).flush({
      ids: [],
      hiddenCount: 0,
      results: [{
        id: resultId,
        urls: {},
        showName: 'Northwind Briefing',
        released: '2026-10-01T10:00:00Z',
        subjects: [],
        enrichedTimeFromApple: false,
        enrichedUrlFromSpotify: false,
        autoHidden: false,
        matchingPodcasts: [
          { id: stillThereId, name: 'Playlist cut', visible: false, visibleEpisodes: 4 },
          { id: removedId, name: 'Northwind Briefing', visible: false, visibleEpisodes: 0 }
        ]
      }]
    });

    await Promise.resolve();
    const first = http.expectOne(api(`/podcast/${stillThereId}`));
    first.flush({ id: stillThereId, name: 'Playlist cut', removed: false });

    await Promise.resolve();
    const second = http.expectOne(api(`/podcast/${removedId}`));
    second.flush({
      id: removedId,
      name: 'Northwind Briefing',
      removed: true,
      youTubeChannelId: 'UCbannedchannel000000001'
    });

    const read = await pending;
    expect(read.podcast.id).toBe(removedId);
    expect(read.podcast.removed).toBe(true);
    http.verify();
  });

  it('surfaces a 409 text body through the ban failure helper', async () => {
    const resultId = 'b6f1c2d4-0000-4000-8000-000000000001';
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthServiceWrapper,
          useValue: { authService: { getAccessTokenSilently: () => of('token') } }
        }
      ]
    });
    const service = TestBed.inject(DiscoveryBanService);
    const http = TestBed.inject(HttpTestingController);
    const pending = service.ban(resultId).then(
      () => { throw new Error('expected refusal'); },
      (failure: unknown) => failure
    );

    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(api(`/discovery-curation/${resultId}/ban`)).flush(
      JSON.stringify({ error: 'A news organisation or TV show already owns this channel.' }),
      { status: 409, statusText: 'Conflict' }
    );

    expect(banFailureMessage(await pending)).toBe('A news organisation or TV show already owns this channel.');
    http.verify();
  });
});
