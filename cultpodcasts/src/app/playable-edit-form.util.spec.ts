import { alternativeTitleLines, buildPlayableEditForm, filmChanges, imdbTitleUrl, int32Max, newPlayableLinkGroup, newYouTubeAlternateGroup, playableEditHasIdentity, playableFieldsChanges, tmdbMovieUrl, tmdbTvShowUrl, tvdbEpisodeUrl, tvdbSeriesUrl, tvShowEpisodeChanges } from './playable-edit-form.util';
import { FilmDto, NewsReportDto, TvShowEpisodeDto } from './playable-edit.interface';

const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outletId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function report(overrides: Partial<NewsReportDto> = {}): NewsReportDto {
  return {
    id: reportId,
    title: 'Bulletin',
    description: 'Synthetic report',
    release: '2026-01-02',
    duration: '0:06:30',
    explicit: false,
    ignored: false,
    removed: false,
    posted: false,
    tweeted: true,
    blueskyPosted: true,
    subjects: ['Politics'],
    searchTerms: null,
    hashTag: null,
    language: null,
    guests: null,
    newsOrganisationId: outletId,
    newsOrganisationName: 'Desk',
    ...overrides
  };
}

describe('playable edit form', () => {
  it('builds the form from the GET: English is unset, missing lists are empty, hash tag gets #', () => {
    const form = buildPlayableEditForm(report({ hashTag: 'desk', guests: ['Ann Example'] }));
    const value = form.getRawValue();
    expect(value.lang).toBe('unset');
    expect(value.hashTag).toBe('#desk');
    expect(value.guests).toEqual(['Ann Example']);
    expect(value.searchTerms).toBe('');
    expect(value.release).toBe('2026-01-02');
    expect(form.controls.imdbId).toBeUndefined();
  });

  it('sends an additional YouTube keep-list for a news report, with the ids the form loaded', () => {
    const dto = report({
      additionalYouTube: [
        { youTubeId: 'GSIPAfDO_ec', url: 'https://www.youtube.com/watch?v=GSIPAfDO_ec', channelName: 'Desk', title: 'Manic' }
      ]
    });
    const form = buildPlayableEditForm(dto, 'news');
    expect(form.controls.additionalYouTube).toBeTruthy();
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({});
    form.controls.additionalYouTube!.removeAt(0);
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({
      additionalYouTube: [],
      expectedAdditionalYouTubeIds: ['GSIPAfDO_ec']
    });
    const promote = buildPlayableEditForm(dto, 'news');
    promote.controls.promoteYouTubeId!.setValue('GSIPAfDO_ec');
    expect(playableFieldsChanges(dto, promote.getRawValue())).toEqual({ promoteYouTubeId: 'GSIPAfDO_ec' });
  });

  it('a TV episode change includes the same additional YouTube keep-list', () => {
    const dto: TvShowEpisodeDto = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      title: 'Part',
      description: 'Synthetic episode',
      release: '2026-01-02',
      duration: '0:44:00',
      explicit: false,
      ignored: false,
      removed: false,
      posted: false,
      tweeted: false,
      blueskyPosted: false,
      subjects: [],
      tvShowId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      additionalYouTube: [
        { youTubeId: 'GSIPAfDO_ec', url: 'https://www.youtube.com/watch?v=GSIPAfDO_ec', title: 'Manic' }
      ]
    };
    const form = buildPlayableEditForm(dto, 'tv');
    form.controls.promoteYouTubeId!.setValue('GSIPAfDO_ec');
    expect(tvShowEpisodeChanges(dto, form.getRawValue())).toEqual({ promoteYouTubeId: 'GSIPAfDO_ec' });
  });

  it('sends nothing when nothing changed (including the normalised hash tag and English)', () => {
    const dto = report({ hashTag: 'desk', language: 'en' });
    const form = buildPlayableEditForm(dto);
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({});
  });

  it('sends a subjects or guests reorder on its own as a change, in the new order', () => {
    const dto = report({ subjects: ['Politics', 'Cults', 'Media'], guests: ['Ann Example', 'Bo Example'] });
    const form = buildPlayableEditForm(dto);
    form.controls.subjects.setValue(['Media', 'Politics', 'Cults']);
    form.controls.guests.setValue(['Bo Example', 'Ann Example']);
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({
      subjects: ['Media', 'Politics', 'Cults'],
      guests: ['Bo Example', 'Ann Example']
    });
  });

  it('sends only the changed fields in the PATCH wire shape', () => {
    const dto = report();
    const form = buildPlayableEditForm(dto);
    form.patchValue({
      title: '  Bulletin two ',
      release: '2026-01-03',
      duration: '0:07:00',
      tweeted: false,
      blueskyPosted: false,
      removed: true,
      subjects: ['Politics', 'Sport'],
      searchTerms: ' desk ',
      hashTag: '#desk #news',
      guests: ['Ann Example'],
      lang: 'fr'
    });
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({
      title: 'Bulletin two',
      release: '2026-01-03',
      duration: '0:07:00',
      tweeted: false,
      blueskyPosted: false,
      removed: true,
      subjects: ['Politics', 'Sport'],
      searchTerms: 'desk',
      hashTag: '#desk #news',
      guests: ['Ann Example'],
      language: 'fr'
    });
  });

  it('clears with empty values: hash tag, search terms, subjects, guests, language back to English', () => {
    const dto = report({ hashTag: '#desk', searchTerms: 'desk', subjects: ['Politics'], guests: ['Ann Example'], language: 'fr' });
    const form = buildPlayableEditForm(dto);
    form.patchValue({ hashTag: '', searchTerms: '', subjects: [], guests: [], lang: 'unset' });
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({
      hashTag: '',
      searchTerms: '',
      subjects: [],
      guests: [],
      language: ''
    });
  });

  it('never sends a blank title, release or duration', () => {
    const dto = report({ blueskyPosted: false });
    const form = buildPlayableEditForm(dto);
    form.patchValue({ title: '  ', release: '', duration: '' });
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({});
  });

  it('sends blueskyPosted true when ticking Bluesky posted on an unposted item', () => {
    const dto = report({ blueskyPosted: false });
    const form = buildPlayableEditForm(dto);
    form.patchValue({ blueskyPosted: true });
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({ blueskyPosted: true });
  });

  it('blueskyPosted / Submit does not throw when form release is still a Date (JsonDateInterceptor)', () => {
    const dto = report({
      release: new Date('2026-11-02T00:00:00Z'),
      blueskyPosted: true
    });
    const form = buildPlayableEditForm(dto);
    const next = {
      ...form.getRawValue(),
      // Pre-normalize bug: control held a Date and Submit called release.trim()
      release: new Date('2026-11-02T00:00:00Z') as unknown as string,
      blueskyPosted: false
    };
    expect(() => playableFieldsChanges(dto, next)).not.toThrow();
    expect(playableFieldsChanges(dto, next)).toEqual({ blueskyPosted: false });
  });

  it('news and TV Urls tab PATCH services the same way as film', () => {
    const archive = 'https://archive.org/details/synthetic-playable';
    const iplayer = 'https://www.bbc.co.uk/iplayer/episode/p0synth1/synthetic-playable';
    const youtube = 'https://www.youtube.com/watch?v=synthetic01';
    const news = report({ services: { internetArchive: { url: archive }, bbcIplayer: { url: iplayer } } });
    const newsForm = buildPlayableEditForm(news);
    expect(newsForm.controls.links!.getRawValue()).toEqual([
      { url: archive, image: '' },
      { url: iplayer, image: '' }
    ]);
    expect(playableFieldsChanges(news, newsForm.getRawValue())).toEqual({});
    newsForm.controls.links!.removeAt(1);
    newsForm.controls.links!.push(newPlayableLinkGroup(youtube));
    expect(playableFieldsChanges(news, newsForm.getRawValue()).services).toEqual({
      youtube: { url: youtube },
      bbcIplayer: { url: '', image: '' }
    });

    const tv: TvShowEpisodeDto = {
      ...news,
      tvShowId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      tvShowName: 'Nightly',
      imdbId: null,
      tvdbId: null,
      tmdbId: null
    };
    const tvForm = buildPlayableEditForm(tv, 'tv');
    expect(tvShowEpisodeChanges(tv, tvForm.getRawValue())).toEqual({});
    tvForm.controls.links!.removeAt(1);
    tvForm.controls.links!.push(newPlayableLinkGroup(youtube));
    expect(tvShowEpisodeChanges(tv, tvForm.getRawValue()).services).toEqual({
      youtube: { url: youtube },
      bbcIplayer: { url: '', image: '' }
    });
  });

  it('PATCHes image-only service edits without dropping url, and seeds images from dto.services', () => {
    const archive = 'https://archive.org/details/synthetic-playable';
    const oldImage = 'https://cdn.example.test/archive-old.jpg';
    const newImage = 'https://cdn.example.test/archive-new.jpg';
    const news = report({
      services: { internetArchive: { url: archive, image: oldImage } }
    });
    const form = buildPlayableEditForm(news);
    expect(form.controls.links!.getRawValue()).toEqual([{ url: archive, image: oldImage }]);
    form.controls.links!.at(0).controls.image.setValue(newImage);
    expect(playableFieldsChanges(news, form.getRawValue()).services).toEqual({
      internetArchive: { image: newImage }
    });
    form.controls.links!.at(0).controls.image.setValue('');
    expect(playableFieldsChanges(news, form.getRawValue()).services).toEqual({
      internetArchive: { image: '' }
    });
  });

  it('TV adds the identity id patch: omit unchanged, blank clears (imdbId "", tvdbId 0, tmdbId 0), id sets', () => {
    const dto: TvShowEpisodeDto = {
      ...report(),
      tvShowId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      tvShowName: 'Nightly',
      imdbId: 'tt0000001',
      tvdbId: null,
      tmdbId: 5
    };
    const form = buildPlayableEditForm(dto, 'tv');
    expect(form.getRawValue().imdbId).toBe('tt0000001');
    expect(form.getRawValue().tvdbId).toBe('');
    expect(form.getRawValue().tmdbId).toBe('5');
    expect('imdb' in form.controls).toBe(false);
    expect('tvdb' in form.controls).toBe(false);
    expect(tvShowEpisodeChanges(dto, form.getRawValue())).toEqual({});
    form.patchValue({ imdbId: '', tvdbId: ' 4242 ', tmdbId: '', explicit: true });
    expect(tvShowEpisodeChanges(dto, form.getRawValue())).toEqual({
      explicit: true,
      imdbId: '',
      tvdbId: 4242,
      tmdbId: 0
    });
  });

  it('TV validates the identity ids', () => {
    const dto: TvShowEpisodeDto = { ...report(), tvShowId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
    const form = buildPlayableEditForm(dto, 'tv');
    form.patchValue({ imdbId: 'nm0000001', tvdbId: 'x', tmdbId: '-3' });
    expect(form.controls.imdbId!.hasError('pattern')).toBe(true);
    expect(form.controls.tvdbId!.hasError('pattern')).toBe(true);
    expect(form.controls.tmdbId!.hasError('pattern')).toBe(true);
    form.controls.tmdbId!.setValue(String(int32Max + 1));
    expect(form.controls.tmdbId!.hasError('int32Max')).toBe(true);
    form.controls.tmdbId!.setValue(String(int32Max));
    expect(form.controls.tmdbId!.valid).toBe(true);
  });

  it('generates page URLs from ids, and nothing for a blank or invalid id', () => {
    expect(imdbTitleUrl('tt0000001')).toBe('https://www.imdb.com/title/tt0000001/');
    expect(imdbTitleUrl(' tt0000001 ')).toBe('https://www.imdb.com/title/tt0000001/');
    expect(imdbTitleUrl('')).toBe('');
    expect(imdbTitleUrl('nm0000001')).toBe('');
    expect(tvdbSeriesUrl('123')).toBe('https://www.thetvdb.com/dereferrer/series/123');
    expect(tvdbSeriesUrl(123)).toBe('https://www.thetvdb.com/dereferrer/series/123');
    expect(tvdbEpisodeUrl('456')).toBe('https://www.thetvdb.com/dereferrer/episode/456');
    expect(tvdbEpisodeUrl(0)).toBe('');
    expect(tvdbEpisodeUrl('')).toBe('');
    expect(tvdbEpisodeUrl('abc')).toBe('');
    expect(tmdbMovieUrl('42')).toBe('https://www.themoviedb.org/movie/42');
    expect(tmdbMovieUrl(0)).toBe('');
    expect(tmdbTvShowUrl('255311')).toBe('https://www.themoviedb.org/tv/255311');
    expect(tmdbTvShowUrl('')).toBe('');
  });

  describe('film', () => {
    function film(overrides: Partial<FilmDto> = {}): FilmDto {
      const { newsOrganisationId: _o, newsOrganisationName: _n, ...playable } = report();
      return {
        ...playable,
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        title: 'One Off',
        name: 'One Off',
        publisher: 'Example Pictures',
        imdbId: 'tt0000002',
        release: '1999',
        ...overrides
      };
    }

    it('the Identity tab is for the tv and film variants only, and only TV gets TheTVDB', () => {
      expect(playableEditHasIdentity('news')).toBe(false);
      expect(playableEditHasIdentity('tv')).toBe(true);
      expect(playableEditHasIdentity('film')).toBe(true);
      expect(buildPlayableEditForm(film(), 'news').controls.imdbId).toBeUndefined();
      expect(buildPlayableEditForm(film(), 'tv').controls.tvdbId).toBeDefined();
      expect(buildPlayableEditForm(film(), 'film').controls.tvdbId).toBeUndefined();
    });

    it('builds a film form: disabled title, publisher, IMDb id (no TheTVDB), year-or-date release', () => {
      const form = buildPlayableEditForm(film(), 'film');
      expect(form.controls.title.disabled).toBe(true);
      expect(form.controls.publisher?.value).toBe('Example Pictures');
      expect(form.controls.imdbId?.value).toBe('tt0000002');
      expect(form.controls.tvdbId).toBeUndefined();
      expect('imdb' in form.controls).toBe(false);
      expect(form.valid).toBe(true);
      form.controls.release.setValue('1999-05-01');
      expect(form.valid).toBe(true);
      form.controls.release.setValue('May 1999');
      expect(form.controls.release.hasError('pattern')).toBe(true);
    });

    it('normalizes DateTimeUtc release (Date after JsonDateInterceptor, or ISO string) to yyyy-MM-dd so Submit stays enabled', () => {
      const fromDate = buildPlayableEditForm(
        film({ release: new Date('2026-10-27T13:00:00Z') }),
        'film'
      );
      expect(fromDate.controls.release.value).toBe('2026-10-27');
      expect(fromDate.valid).toBe(true);

      const fromIso = buildPlayableEditForm(
        film({ release: '2026-10-27T13:00:00Z' }),
        'film'
      );
      expect(fromIso.controls.release.value).toBe('2026-10-27');
      expect(fromIso.valid).toBe(true);
    });

    it('does not PATCH release when the GET had DateTimeUtc and the form still shows the same calendar day', () => {
      const previous = film({
        release: new Date('2026-10-27T13:00:00Z'),
        description: 'Before'
      });
      const form = buildPlayableEditForm(previous, 'film');
      form.controls.description.setValue('After');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ description: 'After' });
    });

    it('shows the film alternative titles one per line and sends them only when they change (RedditPodcastPoster#1431)', () => {
      const previous = film({ alternativeTitles: ["Father's House", 'La casa del padre'] });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.controls.alternativeTitles!.value).toBe("Father's House\nLa casa del padre");
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.alternativeTitles!.setValue(" Father's House \n\nfather's house\nFaderhuset ");
      expect(filmChanges(previous, form.getRawValue())).toEqual({ alternativeTitles: ["Father's House", 'Faderhuset'] });
      form.controls.alternativeTitles!.setValue('');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ alternativeTitles: [] });
    });

    it('sends the identity image when it changes, including a clear (RedditPodcastPoster#1435)', () => {
      const previous = film({ image: 'https://image.tmdb.org/t/p/w1280/old.jpg' });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.controls.image!.value).toBe('https://image.tmdb.org/t/p/w1280/old.jpg');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.image!.setValue('https://image.tmdb.org/t/p/w1280/new.jpg');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ image: 'https://image.tmdb.org/t/p/w1280/new.jpg' });
      form.controls.image!.setValue('  ');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ image: '' });
    });

    it('does not send alternative titles for a film that never had any while the box stays empty', () => {
      const previous = film();
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.controls.alternativeTitles!.value).toBe('');
      form.controls.alternativeTitles!.setValue('  \n ');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
    });

    it('alternativeTitleLines trims, drops blanks and case-insensitive repeats, and keeps the first spelling', () => {
      expect(alternativeTitleLines(" A \r\n\na\nB\n b ")).toEqual(['A', 'B']);
      expect(alternativeTitleLines(undefined)).toEqual([]);
    });

    it('builds no alternative titles box for news or TV', () => {
      expect(buildPlayableEditForm(film(), 'news').controls.alternativeTitles).toBeUndefined();
    });

    it('never sends title; sends publisher (trimmed, empty clears) and the IMDb id patch', () => {
      const previous = film();
      const form = buildPlayableEditForm(previous, 'film');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.title.setValue('Something else');
      form.controls.publisher!.setValue('  ');
      form.controls.imdbId!.setValue('tt0000009');
      expect(filmChanges(previous, form.getRawValue())).toEqual({
        publisher: '',
        imdbId: 'tt0000009'
      });
    });

    it('leaves the IMDb id alone when it only differs by whitespace, and clears it with an empty string', () => {
      const previous = film();
      const form = buildPlayableEditForm(previous, 'film');
      form.controls.imdbId!.setValue(' tt0000002 ');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.imdbId!.setValue('');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ imdbId: '' });
    });

    it('sends the IMDb id (blank clears) and the TMDB id (blank sends 0 to clear), and validates both', () => {
      const previous = film({ imdbId: 'tt0000002', tmdbId: 7 });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.controls.tmdbId!.value).toBe('7');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.imdbId!.setValue(' tt0000009 ');
      form.controls.tmdbId!.setValue('42');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ imdbId: 'tt0000009', tmdbId: 42 });
      form.controls.imdbId!.setValue('');
      form.controls.tmdbId!.setValue('');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ imdbId: '', tmdbId: 0 });
      form.controls.imdbId!.setValue('nm0000001');
      form.controls.tmdbId!.setValue('-3');
      expect(form.controls.imdbId!.hasError('pattern')).toBe(true);
      expect(form.controls.tmdbId!.hasError('pattern')).toBe(true);
      form.controls.tmdbId!.setValue(String(int32Max + 1));
      expect(form.controls.tmdbId!.hasError('int32Max')).toBe(true);
      form.controls.tmdbId!.setValue(String(int32Max));
      expect(form.controls.tmdbId!.valid).toBe(true);
    });

    it('patches links per service: a new URL files under its service, a removed one clears its key, an unchanged one is not sent', () => {
      const archive = 'https://archive.org/details/synthetic-film';
      const iplayer = 'https://www.bbc.co.uk/iplayer/episode/p0synth1/synthetic-film';
      const previous = film({ services: { internetArchive: { url: archive }, bbcIplayer: { url: iplayer } } });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.controls.links!.getRawValue()).toEqual([
        { url: archive, image: '' },
        { url: iplayer, image: '' }
      ]);
      expect(filmChanges(previous, form.getRawValue())).toEqual({});

      form.controls.links!.removeAt(1);
      form.controls.links!.push(newPlayableLinkGroup('https://www.youtube.com/watch?v=synthetic01'));

      expect(form.valid).toBe(true);
      expect(filmChanges(previous, form.getRawValue()).services).toEqual({
        youtube: { url: 'https://www.youtube.com/watch?v=synthetic01' },
        bbcIplayer: { url: '', image: '' }
      });
    });

    it('rejects a relative link and two links for one service; an unlisted host files under its host key', () => {
      const film0 = film({ services: null });
      const form = buildPlayableEditForm(film0, 'film');
      const links = form.controls.links!;
      links.push(newPlayableLinkGroup('not a url'));
      expect(links.at(0).controls.url.hasError('playableLinkUrl')).toBe(true);
      links.at(0).controls.url.setValue('https://synthetic-unknown-service.example/watch/1');
      expect(links.at(0).valid).toBe(true);
      expect(filmChanges(film0, form.getRawValue()).services).toEqual({
        syntheticunknownserviceexample: { url: 'https://synthetic-unknown-service.example/watch/1' }
      });
      links.at(0).controls.url.setValue('https://www.youtube.com/watch?v=synthetic01');
      links.push(newPlayableLinkGroup('https://www.youtube.com/watch?v=synthetic02'));
      expect(links.hasError('playableLinkDuplicate')).toBe(true);
      expect(form.valid).toBe(false);
    });

    it('keeps an existing link the client cannot classify valid, so an old link never blocks a save', () => {
      const odd = 'https://synthetic-unknown-service.example/watch/1';
      const previous = film({ services: { legacyKey: { url: odd } } });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.valid).toBe(true);
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.links!.removeAt(0);
      expect(filmChanges(previous, form.getRawValue()).services).toEqual({ legacyKey: { url: '', image: '' } });
    });

    it('sends the kept trailers in order with their titles only when the list or a title changed', () => {
      const trailers = [
        { id: 't1', title: 'Synthetic Teaser', url: 'https://www.youtube.com/watch?v=synthetic01', duration: '0:02:11' },
        { id: 't2', title: 'Synthetic Clip', url: 'https://www.youtube.com/watch?v=synthetic02', duration: '0:00:45' },
        { id: 't3', title: 'Synthetic Spot', url: 'https://www.youtube.com/watch?v=synthetic03', duration: '0:00:30' }
      ];
      const previous = film({ trailers });
      const form = buildPlayableEditForm(previous, 'film');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});

      const array = form.controls.trailers!;
      const second = array.at(1);
      array.removeAt(1);
      array.insert(0, second);
      array.removeAt(2);
      array.at(1).controls.title.setValue('  Renamed Teaser  ');

      expect(filmChanges(previous, form.getRawValue()).trailers).toEqual([
        { id: 't2', title: 'Synthetic Clip' },
        { id: 't1', title: 'Renamed Teaser' }
      ]);
      expect(filmChanges(previous, form.getRawValue()).expectedTrailerIds).toEqual(['t1', 't2', 't3']);
      array.clear();
      expect(filmChanges(previous, form.getRawValue()).trailers).toEqual([]);
      expect(filmChanges(previous, form.getRawValue()).expectedTrailerIds).toEqual(['t1', 't2', 't3']);
    });

    it('requires a trailer title so blanking cannot look saved while the server keeps the old title', () => {
      const previous = film({
        trailers: [
          { id: 't1', title: 'Synthetic Teaser', url: 'https://www.youtube.com/watch?v=synthetic01', duration: '0:02:11' }
        ]
      });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.valid).toBe(true);
      form.controls.trailers!.at(0).controls.title.setValue('');
      expect(form.controls.trailers!.at(0).controls.title.hasError('required')).toBe(true);
      expect(form.valid).toBe(false);
    });

    it('rejects a whitespace-only trailer title so spaces cannot look saved while the server keeps the old title', () => {
      const previous = film({
        trailers: [
          { id: 't1', title: 'Synthetic Teaser', url: 'https://www.youtube.com/watch?v=synthetic01', duration: '0:02:11' }
        ]
      });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.valid).toBe(true);
      form.controls.trailers!.at(0).controls.title.setValue('   ');
      expect(form.controls.trailers!.at(0).controls.title.hasError('required')).toBe(true);
      expect(form.valid).toBe(false);
    });

    it('sends additional YouTube keep/add/remove and a promote, and expected ids from the loaded list (RPP #1411)', () => {
      const previous = film({
        additionalYouTube: [
          { youTubeId: 'GSIPAfDO_ec', url: 'https://www.youtube.com/watch?v=GSIPAfDO_ec', channelName: 'True Crime Fix', title: 'Manic' }
        ]
      });
      const form = buildPlayableEditForm(previous, 'film');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});

      const array = form.controls.additionalYouTube!;
      array.push(newYouTubeAlternateGroup('', 'https://www.youtube.com/watch?v=VCRf_qazO9s', '', 'Real Stories'));
      const changes = filmChanges(previous, form.getRawValue());
      expect(changes.additionalYouTube).toEqual([
        { youTubeId: 'GSIPAfDO_ec' },
        { url: 'https://www.youtube.com/watch?v=VCRf_qazO9s', channelName: 'Real Stories' }
      ]);
      expect(changes.expectedAdditionalYouTubeIds).toEqual(['GSIPAfDO_ec']);

      array.removeAt(0);
      expect(filmChanges(previous, form.getRawValue()).additionalYouTube).toEqual([
        { url: 'https://www.youtube.com/watch?v=VCRf_qazO9s', channelName: 'Real Stories' }
      ]);

      const promoteOnly = buildPlayableEditForm(previous, 'film');
      promoteOnly.controls.promoteYouTubeId!.setValue('GSIPAfDO_ec');
      expect(filmChanges(previous, promoteOnly.getRawValue())).toEqual({ promoteYouTubeId: 'GSIPAfDO_ec' });
    });

    it('rejects a new additional YouTube row that is blank or not a YouTube URL', () => {
      const form = buildPlayableEditForm(film(), 'film');
      expect(form.valid).toBe(true);
      form.controls.additionalYouTube!.push(newYouTubeAlternateGroup());
      expect(form.controls.additionalYouTube!.at(0).controls.url.hasError('required')).toBe(true);
      expect(form.valid).toBe(false);
      form.controls.additionalYouTube!.at(0).controls.url.setValue('https://example.com/watch?v=nope');
      expect(form.controls.additionalYouTube!.at(0).controls.url.hasError('youTubeUrl')).toBe(true);
      expect(form.valid).toBe(false);
      form.controls.additionalYouTube!.at(0).controls.url.setValue('https://www.youtube.com/watch?v=GSIPAfDO_ec');
      expect(form.controls.additionalYouTube!.at(0).valid).toBe(true);
      expect(form.valid).toBe(true);
    });
  });
});
