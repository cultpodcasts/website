import { ALL_LANGUAGES_VALUE, ENGLISH_LANGUAGE_VALUE } from './subject-language-filter';
import {
  decodeLanguageParam,
  encodeLanguageParam,
  keepOffered,
  buildFilterFragment,
  parseFilterFragment,
  readParamList,
  routeStateKey
} from './browse-filter-params';

describe('browse-filter-params', () => {
  it('gives no lang param for the English default', () => {
    expect(encodeLanguageParam([ENGLISH_LANGUAGE_VALUE])).toBeNull();
    expect(encodeLanguageParam([])).toBeNull();
  });

  it('encodes All, single and multiple languages', () => {
    expect(encodeLanguageParam([ALL_LANGUAGES_VALUE])).toBe('all');
    expect(encodeLanguageParam(['sw'])).toBe('sw');
    expect(encodeLanguageParam(['sw', 'ki'])).toBe('sw,ki');
    expect(encodeLanguageParam([ENGLISH_LANGUAGE_VALUE, 'sw'])).toBe('en,sw');
  });

  it('round-trips every language chip state through the lang param', () => {
    const states = [[ALL_LANGUAGES_VALUE], ['sw'], ['sw', 'ki'], [ENGLISH_LANGUAGE_VALUE, 'pt-BR']];
    for (const state of states) {
      expect(decodeLanguageParam(encodeLanguageParam(state))).toEqual(state);
    }
  });

  it('ignores a missing, empty or malformed lang param', () => {
    expect(decodeLanguageParam(undefined)).toBeNull();
    expect(decodeLanguageParam('')).toBeNull();
    expect(decodeLanguageParam(' , ')).toBeNull();
    expect(decodeLanguageParam('<b>')).toBeNull();
    expect(decodeLanguageParam(42)).toBeNull();
  });

  it('keeps the usable codes from a partly malformed lang param', () => {
    expect(decodeLanguageParam('sw,<b>,ki,sw')).toEqual(['sw', 'ki']);
    expect(decodeLanguageParam(['sw', 'ki'])).toEqual(['sw', 'ki']);
    expect(decodeLanguageParam('EN-gb,sw')).toEqual([ENGLISH_LANGUAGE_VALUE, 'sw']);
  });

  it('treats all anywhere in the lang param as All', () => {
    expect(decodeLanguageParam('sw,ALL')).toEqual([ALL_LANGUAGES_VALUE]);
  });

  it('reads single and repeated list params', () => {
    expect(readParamList({ show: 'Show A' }, 'show')).toEqual(['Show A']);
    expect(readParamList({ show: ['Show A', ' Show B ', '', 'Show A'] }, 'show')).toEqual(['Show A', 'Show B']);
    expect(readParamList({}, 'show')).toEqual([]);
  });

  it('builds no fragment for the default state', () => {
    expect(buildFilterFragment({ show: [], lang: null })).toBeNull();
    expect(buildFilterFragment({})).toBeNull();
  });

  it('builds a URLSearchParams-style fragment with repeated list keys', () => {
    expect(buildFilterFragment({ show: ['Show A', 'Show B'], lang: 'sw,ki' }))
      .toBe('show=Show A&show=Show B&lang=sw,ki');
  });

  it('escapes only the characters that would break the key/value split', () => {
    expect(buildFilterFragment({ show: ['A&B=C+D#E%F, G'] })).toBe('show=A%26B%3DC%2BD%23E%25F, G');
  });

  it('round-trips filters through the fragment', () => {
    const shows = ['Show A', 'Show, with comma', 'Tom & Jo = 1+1 #2 100%', 'Café'];
    const params = parseFilterFragment(buildFilterFragment({ show: shows, lang: encodeLanguageParam(['sw', 'ki']) }));
    expect(readParamList(params, 'show')).toEqual(shows);
    expect(decodeLanguageParam(params['lang'])).toEqual(['sw', 'ki']);
  });

  it('parses an empty or missing fragment as no filters', () => {
    expect(parseFilterFragment(null)).toEqual({});
    expect(parseFilterFragment('')).toEqual({});
  });

  it('parses a hand-written fragment, ignoring keys it does not know', () => {
    expect(parseFilterFragment('lang=sw&show=Show A&show=Show B&other=1'))
      .toEqual({ lang: 'sw', show: ['Show A', 'Show B'], other: '1' });
  });

  it('keys routes regardless of param order, single-value arrays or empty fragments', () => {
    expect(routeStateKey({ q: 'x' }, { sort: ['rank'], page: '2' }, 'lang=sw'))
      .toBe(routeStateKey({ q: 'x' }, { page: '2', sort: 'rank' }, 'lang=sw'));
    expect(routeStateKey({ q: 'x' }, {}, 'lang=sw'))
      .not.toBe(routeStateKey({ q: 'x' }, {}, 'lang=ki'));
    expect(routeStateKey({}, { sort: null }, '')).toBe(routeStateKey({}, {}, null));
  });

  it('keeps only values the facets offer', () => {
    expect(keepOffered(['Show A', 'Gone'], [{ value: 'Show A' }, { value: 'Show B' }])).toEqual(['Show A']);
    expect(keepOffered(['Show A'], undefined)).toEqual([]);
  });
});
