import {
  ambiguousCandidateFromCatalogueParent,
  ambiguousCandidateFromPodcast
} from './ambiguous-name-candidate';
import { CatalogueParentDto } from './catalogue-parent.interface';
import { Podcast } from './podcast.interface';

describe('ambiguous-name-candidate', () => {
  it('maps podcast and catalogue-parent rows for the same-name picker', () => {
    const podcast = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Desk',
      removed: false,
      spotifyId: 'sp',
      appleId: 1,
      youTubeChannelId: 'UC1',
      youTubePlaylistId: 'PL1',
      twitterHandle: '@a',
      blueskyHandle: '@a.bsky.social'
    } as Podcast;
    const parent: CatalogueParentDto = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Associated Press',
      youTubeChannelId: 'UCHTK',
      twitterHandle: '@AP_Archive',
      removed: false
    };

    expect(ambiguousCandidateFromPodcast(podcast)).toEqual({
      id: podcast.id,
      name: 'Desk',
      spotifyId: 'sp',
      appleId: 1,
      youTubeChannelId: 'UC1',
      youTubePlaylistId: 'PL1',
      twitterHandle: '@a',
      blueskyHandle: '@a.bsky.social',
      removed: false
    });
    expect(ambiguousCandidateFromCatalogueParent(parent).youTubeChannelId).toBe('UCHTK');
    expect(ambiguousCandidateFromCatalogueParent(parent).twitterHandle).toBe('@AP_Archive');
  });
});
