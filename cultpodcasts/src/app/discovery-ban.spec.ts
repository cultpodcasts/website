import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { DiscoveryBanService } from './discovery-ban.service';
import { bannedResultIds, isSameBannedChannel } from './discovery-ban';
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
    expect(bannedResultIds([source, sibling, other, sameChannel], banned)).toEqual([
      source.id,
      sibling.id,
      sameChannel.id
    ]);
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
});
