import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SearchSuggestionsService } from './search-suggestions.service';
import { SuggestionsCorpus } from './search-suggestions.interface';

describe('SearchSuggestionsService', () => {
  let service: SearchSuggestionsService;
  let httpMock: HttpTestingController;

  const corpus: SuggestionsCorpus = {
    generatedAtUtc: '2026-07-24T00:00:00Z',
    entries: [
      { type: 'subject', canonical: 'Scientology', searchText: 'scientology' },
      { type: 'subject', canonical: 'Scientology', searchText: 'cos', alias: 'CoS' },
      { type: 'subject', canonical: "Hustler's University", searchText: "hustler's university" },
      { type: 'podcast', canonical: 'IndoctriNation', searchText: 'indoctrination' },
      { type: 'podcast', canonical: 'Behind the Bastards', searchText: 'behind the bastards' }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(SearchSuggestionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushCorpus(): void {
    httpMock.expectOne('assets/search-suggestions.json').flush(corpus);
  }

  it('matches against pre-lowercased searchText without re-scanning nested fields', async () => {
    const pending = service.suggest('sci');
    flushCorpus();
    const results = await pending;
    expect(results[0]).toEqual(jasmine.objectContaining({
      type: 'subject',
      value: 'Scientology',
      label: 'Scientology'
    }));
  });

  it('prefers exact over prefix and collapses alias+name to one subject', async () => {
    const pending = service.suggest('scientology');
    flushCorpus();
    const results = await pending;
    expect(results.filter(r => r.value === 'Scientology').length).toBe(1);
    expect(results[0].matchedAlias).toBeUndefined();
  });

  it('surfaces matchedAlias when the winning row is an alias', async () => {
    const pending = service.suggest('cos');
    flushCorpus();
    const results = await pending;
    expect(results[0]).toEqual(jasmine.objectContaining({
      type: 'subject',
      value: 'Scientology',
      matchedAlias: 'CoS'
    }));
  });

  it('navigates with canonical value while displayCatalogName applies to label', async () => {
    const pending = service.suggest("hustler's");
    flushCorpus();
    const results = await pending;
    expect(results[0].value).toBe("Hustler's University");
    expect(results[0].label).toBe('Andrew Tate');
  });

  it('matches podcasts from the flat index', async () => {
    const pending = service.suggest('behind');
    flushCorpus();
    const results = await pending;
    expect(results.some(r => r.type === 'podcast' && r.value === 'Behind the Bastards')).toBeTrue();
  });
});
