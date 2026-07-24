import { HomepageEpisode } from './homepage-episode.interface';
import { isMetaSubject, isWellKnownCult, pickObscureCults } from './obscure-cults';

function ep(id: string, subjects: string[]): HomepageEpisode {
  return {
    id,
    podcastName: 'Show',
    episodeTitle: `Episode ${id}`,
    episodeDescription: '',
    release: new Date('2026-07-20T12:00:00Z'),
    duration: '01:00:00',
    spotify: undefined,
    apple: undefined,
    youtube: undefined,
    bbc: undefined,
    internetArchive: undefined,
    subjects,
    image: new URL(`https://example.com/${id}.jpg`),
  };
}

describe('obscure-cults', () => {
  it('flags meta and well-known subjects', () => {
    expect(isMetaSubject('Cult Psychology')).toBeTrue();
    expect(isMetaSubject('Geelong Revival Centre')).toBeFalse();
    expect(isWellKnownCult('Scientology')).toBeTrue();
    expect(isWellKnownCult('Ramtha\'s School of Enlightenment')).toBeFalse();
  });

  it('picks long-tail groups and skips household names / meta', () => {
    const episodes = [
      ep('1', ['Scientology', 'Cult Psychology']),
      ep('2', ['Geelong Revival Centre']),
      ep('3', ['Ramtha\'s School of Enlightenment']),
      ep('4', ['Geelong Revival Centre']),
      ep('5', ['Human Trafficking']),
      ep('6', ['Oneida Community']),
    ];

    const picked = pickObscureCults(episodes, (e) => e.image?.toString(), {
      limit: 10,
      now: new Date('2026-07-23T12:00:00Z'),
    });

    const names = picked.map((c) => c.subject);
    expect(names).toContain('Geelong Revival Centre');
    expect(names).toContain('Ramtha\'s School of Enlightenment');
    expect(names).toContain('Oneida Community');
    expect(names).not.toContain('Scientology');
    expect(names).not.toContain('Cult Psychology');
    expect(names).not.toContain('Human Trafficking');
  });

  it('is stable within the same ISO week', () => {
    const episodes = Array.from({ length: 20 }, (_, i) => ep(String(i), [`Cult ${i}`]));
    const a = pickObscureCults(episodes, () => undefined, {
      limit: 5,
      now: new Date('2026-07-20T12:00:00Z'),
    }).map((c) => c.subject);
    const b = pickObscureCults(episodes, () => undefined, {
      limit: 5,
      now: new Date('2026-07-23T12:00:00Z'),
    }).map((c) => c.subject);
    expect(a).toEqual(b);
  });

  it('flags youtubeArt from the cover URL host', () => {
    const episodes = [
      ep('yt', ['Geelong Revival Centre']),
      ep('sq', ['Oneida Community']),
    ];
    const picked = pickObscureCults(
      episodes,
      (e) =>
        e.id === 'yt'
          ? 'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
          : 'https://i.scdn.co/image/square-cover',
      {
        limit: 10,
        now: new Date('2026-07-23T12:00:00Z'),
      }
    );

    expect(picked.find((c) => c.subject === 'Geelong Revival Centre')?.youtubeArt).toBeTrue();
    expect(picked.find((c) => c.subject === 'Oneida Community')?.youtubeArt).toBeFalse();
  });
});
