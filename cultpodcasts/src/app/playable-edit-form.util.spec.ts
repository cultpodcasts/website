import { buildPlayableEditForm, playableFieldsChanges, tvShowEpisodeChanges } from './playable-edit-form.util';
import { NewsReportDto, TvShowEpisodeDto } from './playable-edit.interface';

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
    const form = buildPlayableEditForm(dto, { identity: true });
    expect(form.getRawValue().imdb).toBe('https://www.imdb.com/title/tt0000001/');
    expect(tvShowEpisodeChanges(dto, form.getRawValue())).toEqual({});
    form.patchValue({ imdb: '', tvdb: 'https://thetvdb.com/series/example/episodes/1', explicit: true });
    expect(tvShowEpisodeChanges(dto, form.getRawValue())).toEqual({
      explicit: true,
      imdb: '',
      tvdb: 'https://thetvdb.com/series/example/episodes/1'
    });
  });
});
