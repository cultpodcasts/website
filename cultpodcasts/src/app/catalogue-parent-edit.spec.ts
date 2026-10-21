import { describe, expect, it } from 'vitest';
import { CatalogueParentDto } from './catalogue-parent.interface';
import { catalogueParentChanges, catalogueParentEditModel, textToList } from './catalogue-parent-edit';
import { CatalogueHub, hubApiRoot, hubParentKind, hubParentLabel, hubPathCommands } from './catalogue-hub';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';

const outlet: CatalogueParentDto = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  name: 'Desk',
  publisher: 'Desk Media',
  description: null,
  language: null,
  removed: false,
  twitterHandle: '@desk',
  knownTerms: ['alpha', 'beta'],
  ignoredSubjects: null,
  imdb: 'https://www.imdb.com/title/tt0000001/'
};

describe('catalogueParentChanges', () => {
  it('sends nothing when the form is unchanged', () => {
    expect(catalogueParentChanges(outlet, catalogueParentEditModel(outlet), false)).toEqual({});
  });

  it('sends only edited fields; a cleared string is "" and a cleared list is []', () => {
    const model = catalogueParentEditModel(outlet);
    model.twitterHandle = '';
    model.description = '  New text ';
    model.knownTerms = '';
    model.ignoredSubjects = 'One, Two ,';
    model.removed = true;
    expect(catalogueParentChanges(outlet, model, false)).toEqual({
      twitterHandle: '',
      description: 'New text',
      knownTerms: [],
      ignoredSubjects: ['One', 'Two'],
      removed: true
    });
  });

  it('only diffs imdb/tvdb for TV shows', () => {
    const model = catalogueParentEditModel(outlet);
    model.imdb = '';
    expect(catalogueParentChanges(outlet, model, false)).toEqual({});
    expect(catalogueParentChanges(outlet, model, true)).toEqual({ imdb: '' });
  });

  it('never includes name (rename is a separate admin action)', () => {
    const changes = catalogueParentChanges(outlet, catalogueParentEditModel(outlet), true) as Record<string, unknown>;
    expect('name' in changes).toBe(false);
  });

  it('splits comma lists and drops blanks', () => {
    expect(textToList(' a, ,b ,')).toEqual(['a', 'b']);
  });
});

describe('catalogue hub helpers', () => {
  it('maps hubs to kind, label, API root and route', () => {
    const cases: [CatalogueHub, CatalogueParentKind, string, string][] = [
      ['news', CatalogueParentKind.NewsOrganisation, 'News Outlet', 'newsorganisation'],
      ['tv', CatalogueParentKind.TvShow, 'TV Show', 'tvshow']
    ];
    for (const [hub, kind, label, root] of cases) {
      expect(hubParentKind(hub)).toBe(kind);
      expect(hubParentLabel(hub)).toBe(label);
      expect(hubApiRoot(hub)).toBe(root);
      expect(hubPathCommands(hub, 'X')).toEqual([`/${hub}`, 'X']);
    }
  });
});
