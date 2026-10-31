import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SearchSuggestionsService } from './search-suggestions.service';
import { SuggestionsCorpus } from './search-suggestions.interface';
import { environment } from './../environments/environment';

describe('SearchSuggestionsService', () => {
    let service: SearchSuggestionsService;
    let httpMock: HttpTestingController;
    const suggestionsUrl = new URL('/search-suggestions', environment.api).toString();

    const corpus: SuggestionsCorpus = {
        generatedAtUtc: new Date('2026-07-24T00:00:00Z'),
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
        httpMock.expectOne(suggestionsUrl).flush(corpus);
    }

    it('matches against pre-lowercased searchText without re-scanning nested fields', async () => {
        const pending = service.suggest('sci');
        flushCorpus();
        const results = await pending;
        expect(results[0]).toEqual(expect.objectContaining({
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
        expect(results[0]).toEqual(expect.objectContaining({
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
        expect(results.some(r => r.type === 'podcast' && r.value === 'Behind the Bastards')).toBe(true);
    });

    it('limits matches to the requested type when a type filter is passed', async () => {
        const pending = service.suggest('in', 8, 'podcast');
        flushCorpus();
        const results = await pending;
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.type === 'podcast')).toBe(true);
        expect(results.some(r => r.type === 'subject')).toBe(false);
    });

    describe('catalogue kinds (TV, news, film)', () => {
        const filmA = '00112233-4455-4677-8899-aabbccddeeff';
        const filmB = '11112233-4455-4677-8899-aabbccddeeff';
        const kindsCorpus: SuggestionsCorpus = {
            generatedAtUtc: new Date('2026-10-21T00:00:00Z'),
            entries: [
                { type: 'tvShow', canonical: 'Synthetic Nightly', searchText: 'synthetic nightly' },
                { type: 'newsOrganisation', canonical: 'Synthetic Desk', searchText: 'synthetic desk' },
                { type: 'film', canonical: 'Synthetic Film', searchText: 'synthetic film', id: filmA },
                { type: 'film', canonical: 'Synthetic Film', searchText: 'synthetic film', id: filmB },
                { type: 'film', canonical: 'Synthetic Film No Id', searchText: 'synthetic film no id' },
                { type: 'podcast', canonical: 'Synthetic Pod', searchText: 'synthetic pod' }
            ]
        };

        it('returns TV, news and film rows with their kind', async () => {
            const pending = service.suggest('synthetic', 20);
            httpMock.expectOne(suggestionsUrl).flush(kindsCorpus);
            const results = await pending;
            expect(results.map(r => r.type).sort()).toEqual(
                ['film', 'film', 'film', 'newsOrganisation', 'podcast', 'tvShow']);
        });

        it('keeps two same-name films apart by id and carries the id through', async () => {
            const pending = service.suggest('synthetic film', 20, 'film');
            httpMock.expectOne(suggestionsUrl).flush(kindsCorpus);
            const results = await pending;
            const named = results.filter(r => r.value === 'Synthetic Film');
            expect(named.map(r => r.itemId).sort()).toEqual([filmA, filmB]);
        });

        it('tolerates a film row without an id', async () => {
            const pending = service.suggest('no id', 20);
            httpMock.expectOne(suggestionsUrl).flush(kindsCorpus);
            const results = await pending;
            expect(results).toEqual([expect.objectContaining({ type: 'film', value: 'Synthetic Film No Id' })]);
            expect(results[0].itemId).toBeUndefined();
            expect('id' in results[0]).toBe(false);
        });

        it('passes an unknown future kind through instead of dropping the corpus', async () => {
            const pending = service.suggest('future', 20);
            httpMock.expectOne(suggestionsUrl).flush({
                generatedAtUtc: new Date('2026-10-21T00:00:00Z'),
                entries: [{ type: 'person', canonical: 'Future Kind', searchText: 'future kind' }]
            });
            const results = await pending;
            expect(results.length).toBe(1);
            expect(results[0].value).toBe('Future Kind');
        });
    });
});
