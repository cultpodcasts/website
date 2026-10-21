import { ALL_LANGUAGES_VALUE, ENGLISH_LANGUAGE_VALUE } from './subject-language-filter';
import {
  decodeLanguageParam,
  encodeLanguageParam,
  keepOffered,
  buildFilterFragment,
  parseFilterFragment,
  readParamList,
  routePathKey,
  routeStateKey,
  writeUrlFragment
} from './browse-filter-params';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';

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

  function fakeLocation(current: string) {
    return {
      path: (includeHash = false) => includeHash ? current : current.split('#')[0],
      getState: () => ({ navigationId: 3 }),
      go: vi.fn(),
    };
  }

  it('pushes a user filter change and replaces a restore or tidy, never scrolling', () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const router = { navigate } as unknown as Router;
    const route = {} as ActivatedRoute;
    const location = fakeLocation('/subject/Topic');

    writeUrlFragment(router, route, location as unknown as Location, 'lang=sw', 'push');
    writeUrlFragment(router, route, location as unknown as Location, 'lang=ki', 'replace');

    expect(navigate.mock.calls).toEqual([
      [[], { relativeTo: route, queryParamsHandling: 'preserve', fragment: 'lang=sw', replaceUrl: false, scroll: 'manual' }],
      [[], { relativeTo: route, queryParamsHandling: 'preserve', fragment: 'lang=ki', replaceUrl: true, scroll: 'manual' }],
    ]);
    expect(location.go).not.toHaveBeenCalled();
  });

  it('keeps the filtered entry when a pushed change removes the fragment', () => {
    // The router would replace here (same path once the hash is ignored), so
    // the current entry is duplicated and the router replaces the copy.
    const navigate = vi.fn().mockResolvedValue(true);
    const location = fakeLocation('/search/part?sort=rank#show=Show%20B');

    writeUrlFragment({ navigate } as unknown as Router, {} as ActivatedRoute, location as unknown as Location, null, 'push');

    expect(location.go).toHaveBeenCalledWith('/search/part?sort=rank#show=Show%20B', '', { navigationId: 3 });
    expect(navigate.mock.calls[0][1]).toMatchObject({ fragment: undefined, replaceUrl: true, scroll: 'manual' });
  });

  it('adds no entry when the fragment is removed and the URL has none yet', () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const location = fakeLocation('/search/part');

    writeUrlFragment({ navigate } as unknown as Router, {} as ActivatedRoute, location as unknown as Location, null, 'push');
    writeUrlFragment({ navigate } as unknown as Router, {} as ActivatedRoute, fakeLocation('/x#a=b') as unknown as Location, null, 'replace');

    expect(location.go).not.toHaveBeenCalled();
    expect(navigate.mock.calls.map(([, extras]) => extras.replaceUrl)).toEqual([true, true]);
  });

  it('keys the path and query alone, so only a fragment change keeps the same page', () => {
    expect(routePathKey({ q: 'x' }, { sort: 'rank' })).toBe(routeStateKey({ q: 'x' }, { sort: ['rank'] }, null));
    expect(routePathKey({ q: 'x' }, {})).not.toBe(routePathKey({ q: 'y' }, {}));
  });
});
