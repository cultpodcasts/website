import {
  parseYouTubeAlternateTokens,
  youTubeAlternateEpisode,
  youTubeWatchUrl,
  youtubeVideoId,
  YOUTUBE_ALTERNATE_CONTENT_KIND,
} from './youtube-alternate';

describe('youtube-alternate', () => {
  it('parses tokens, keeps a | in the channel name, and skips malformed rows', () => {
    const links = parseYouTubeAlternateTokens([
      'GSIPAfDO_ec|2024-03-01|True Crime Fix',
      'abc123||Channel | with bars',
      'noid',
      '|2024-01-01|Missing id',
      'ok||',
    ]);
    expect(links).toEqual([
      {
        youTubeId: 'GSIPAfDO_ec',
        url: youTubeWatchUrl('GSIPAfDO_ec'),
        release: '2024-03-01',
        channelName: 'True Crime Fix',
      },
      {
        youTubeId: 'abc123',
        url: youTubeWatchUrl('abc123'),
        release: '',
        channelName: 'Channel | with bars',
      },
      {
        youTubeId: 'ok',
        url: youTubeWatchUrl('ok'),
        release: '',
        channelName: '',
      },
    ]);
  });

  it('builds a playable rail card with the channel name and a YouTube watch URL', () => {
    const episode = youTubeAlternateEpisode(
      {
        youTubeId: 'GSIPAfDO_ec',
        url: youTubeWatchUrl('GSIPAfDO_ec'),
        release: '2024-03-01',
        channelName: 'True Crime Fix',
      },
      '925e2a11-668f-4dfa-a78d-57dd4de0051f',
      0,
      'Manic'
    );
    expect(episode.contentKind).toBe(YOUTUBE_ALTERNATE_CONTENT_KIND);
    expect(episode.episodeTitle).toBe('True Crime Fix');
    expect(episode.podcastName).toBe('Manic');
    expect(episode.youtubeId).toBe('GSIPAfDO_ec');
    expect(episode.services?.['youtube']?.url?.toString()).toBe('https://www.youtube.com/watch?v=GSIPAfDO_ec');
  });

  it('extracts a video id from watch, share, embed and shorts URLs', () => {
    expect(youtubeVideoId(new URL('https://www.youtube.com/watch?v=GSIPAfDO_ec'))).toBe('GSIPAfDO_ec');
    expect(youtubeVideoId(new URL('https://youtu.be/GSIPAfDO_ec'))).toBe('GSIPAfDO_ec');
    expect(youtubeVideoId(new URL('https://www.youtube.com/embed/GSIPAfDO_ec'))).toBe('GSIPAfDO_ec');
    expect(youtubeVideoId(new URL('https://www.youtube.com/shorts/GSIPAfDO_ec'))).toBe('GSIPAfDO_ec');
    expect(youtubeVideoId(new URL('https://example.com/watch?v=GSIPAfDO_ec'))).toBeUndefined();
  });
});
