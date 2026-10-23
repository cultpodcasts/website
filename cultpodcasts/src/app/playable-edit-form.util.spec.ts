import { buildPlayableEditForm, filmChanges, newFilmLinkControl, playableEditHasIdentity, playableFieldsChanges, tvShowEpisodeChanges } from './playable-edit-form.util';
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
    expect(form.controls.imdb).toBeUndefined();
  });

  it('sends nothing when nothing changed (including the normalised hash tag and English)', () => {
    const dto = report({ hashTag: 'desk', language: 'en' });
    const form = buildPlayableEditForm(dto);
    expect(playableFieldsChanges(dto, form.getRawValue())).toEqual({});
  });

  it('sends only the changed fields in the PATCH wire shape', () => {
    const dto = report();
    const form = buildPlayableEditForm(dto);
    form.patchValue({
      title: '  Bulletin two ',
      release: '2026-01-03',
      duration: '0:07:00',
      tweeted: false,
      removed: true,
      subjects: ['Politics', 'Sport'],
      searchTerms: ' desk ',
      hashTag: '#desk #news',
      guests: ['Ann Example'],
      lang: 'fr'
    });
    expect(playableFieldsChanges(dto, form.getRawValue(), true)).toEqual({
      title: 'Bulletin two',
      release: '2026-01-03',
      duration: '0:07:00',
      tweeted: false,
      unBluesky: true,
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

  it('never sends a blank title, release or duration, and ignores unBluesky when there is no post', () => {
    const dto = report({ blueskyPosted: false });
    const form = buildPlayableEditForm(dto);
    form.patchValue({ title: '  ', release: '', duration: '' });
    expect(playableFieldsChanges(dto, form.getRawValue(), true)).toEqual({});
  });

  it('TV adds the identity patch: omit unchanged, empty string clears, URL sets', () => {
    const dto: TvShowEpisodeDto = {
      ...report(),
      tvShowId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      tvShowName: 'Nightly',
      // As delivered by json-url.interceptor.
      imdb: new URL('https://www.imdb.com/title/tt0000001/'),
      tvdb: null
    };
    const form = buildPlayableEditForm(dto, 'tv');
    expect(form.getRawValue().imdb).toBe('https://www.imdb.com/title/tt0000001/');
    expect(tvShowEpisodeChanges(dto, form.getRawValue())).toEqual({});
    form.patchValue({ imdb: '', tvdb: 'https://thetvdb.com/series/example/episodes/1', explicit: true });
    expect(tvShowEpisodeChanges(dto, form.getRawValue())).toEqual({
      explicit: true,
      imdb: '',
      tvdb: 'https://thetvdb.com/series/example/episodes/1'
    });
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
        imdb: new URL('https://www.imdb.com/title/tt0000002/'),
        release: '1999',
        ...overrides
      };
    }

    it('the Identity tab is for the tv and film variants only, and only TV gets TheTVDB', () => {
      expect(playableEditHasIdentity('news')).toBe(false);
      expect(playableEditHasIdentity('tv')).toBe(true);
      expect(playableEditHasIdentity('film')).toBe(true);
      expect(buildPlayableEditForm(film(), 'news').controls.imdb).toBeUndefined();
      expect(buildPlayableEditForm(film(), 'tv').controls.tvdb).toBeDefined();
      expect(buildPlayableEditForm(film(), 'film').controls.tvdb).toBeUndefined();
    });

    it('builds a film form: disabled title, publisher, IMDb text (no TheTVDB), year-or-date release', () => {
      const form = buildPlayableEditForm(film(), 'film');
      expect(form.controls.title.disabled).toBe(true);
      expect(form.controls.publisher?.value).toBe('Example Pictures');
      expect(form.controls.imdb?.value).toBe('https://www.imdb.com/title/tt0000002/');
      expect(form.controls.tvdb).toBeUndefined();
      expect(form.valid).toBe(true);
      form.controls.release.setValue('1999-05-01');
      expect(form.valid).toBe(true);
      form.controls.release.setValue('May 1999');
      expect(form.controls.release.hasError('pattern')).toBe(true);
    });

    it('never sends title; sends publisher (trimmed, empty clears) and the IMDb patch', () => {
      const previous = film();
      const form = buildPlayableEditForm(previous, 'film');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.title.setValue('Something else');
      form.controls.publisher!.setValue('  ');
      form.controls.imdb!.setValue('https://www.imdb.com/title/tt0000009/');
      expect(filmChanges(previous, form.getRawValue())).toEqual({
        publisher: '',
        imdb: 'https://www.imdb.com/title/tt0000009/'
      });
    });

    it('leaves IMDb alone when it only differs by whitespace, and clears it with an empty string', () => {
      const previous = film();
      const form = buildPlayableEditForm(previous, 'film');
      form.controls.imdb!.setValue(' https://www.imdb.com/title/tt0000002/ ');
      expect(filmChanges(previous, form.getRawValue())).toEqual({});
      form.controls.imdb!.setValue('');
      expect(filmChanges(previous, form.getRawValue())).toEqual({ imdb: '' });
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
    });

    it('patches links per service: a new URL files under its service, a removed one clears its key, an unchanged one is not sent', () => {
      const archive = 'https://archive.org/details/synthetic-film';
      const iplayer = 'https://www.bbc.co.uk/iplayer/episode/p0synth1/synthetic-film';
      const previous = film({ services: { internetArchive: { url: archive }, bbcIplayer: { url: iplayer } } });
      const form = buildPlayableEditForm(previous, 'film');
      expect(form.controls.links!.getRawValue()).toEqual([archive, iplayer]);
      expect(filmChanges(previous, form.getRawValue())).toEqual({});

      form.controls.links!.removeAt(1);
      form.controls.links!.push(newFilmLinkControl('https://www.youtube.com/watch?v=synthetic01'));

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
      links.push(newFilmLinkControl('not a url'));
      expect(links.at(0).hasError('filmLinkUrl')).toBe(true);
      links.at(0).setValue('https://synthetic-unknown-service.example/watch/1');
      expect(links.at(0).valid).toBe(true);
      expect(filmChanges(film0, form.getRawValue()).services).toEqual({
        syntheticunknownserviceexample: { url: 'https://synthetic-unknown-service.example/watch/1' }
      });
      links.at(0).setValue('https://www.youtube.com/watch?v=synthetic01');
      links.push(newFilmLinkControl('https://www.youtube.com/watch?v=synthetic02'));
      expect(links.hasError('filmLinkDuplicate')).toBe(true);
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
  });
});
