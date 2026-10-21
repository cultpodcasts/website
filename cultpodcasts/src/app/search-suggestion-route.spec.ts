import { GuidService } from './guid.service';
import { Suggestion } from './search-suggestions.interface';
import { suggestionCommands, suggestionIcon, suggestionKindLabel } from './search-suggestion-route';

describe('search suggestion route and icon', () => {
    const guids = new GuidService();
    const filmId = '00112233-4455-4677-8899-aabbccddeeff';

    function s(partial: Partial<Suggestion> & Pick<Suggestion, 'type' | 'value'>): Suggestion {
        return { label: partial.value, ...partial };
    }

    it('uses one icon per kind', () => {
        expect(suggestionIcon('podcast')).toBe('podcasts');
        expect(suggestionIcon('tvShow')).toBe('live_tv');
        expect(suggestionIcon('newsOrganisation')).toBe('newspaper');
        expect(suggestionIcon('film')).toBe('movie');
        expect(suggestionIcon('subject')).toBe('sell');
        expect(suggestionIcon('person')).toBe('search');
    });

    it('names each kind for screen readers', () => {
        expect(suggestionKindLabel('tvShow')).toBe('TV show');
        expect(suggestionKindLabel('newsOrganisation')).toBe('News outlet');
        expect(suggestionKindLabel('film')).toBe('Film');
        expect(suggestionKindLabel('person')).toBe('Search');
    });

    it('keeps podcast and subject paths unchanged', () => {
        expect(suggestionCommands(s({ type: 'podcast', value: 'Synthetic Pod' }))
            .toEqual(['/podcast/Synthetic Pod']);
        expect(suggestionCommands(s({ type: 'subject', value: 'Synthetic Topic' }))
            .toEqual(['/subject/Synthetic Topic']);
    });

    it('sends TV shows to /tv/{name} and news outlets to /news/{name}', () => {
        expect(suggestionCommands(s({ type: 'tvShow', value: 'Synthetic Nightly' }))
            .toEqual(['/tv', 'Synthetic Nightly']);
        expect(suggestionCommands(s({ type: 'newsOrganisation', value: 'Synthetic Desk' }))
            .toEqual(['/news', 'Synthetic Desk']);
    });

    it('sends a film to /film/{name}/{shortId} using the Film-prefixed short id', () => {
        const commands = suggestionCommands(s({ type: 'film', value: 'Synthetic Film', itemId: filmId }));
        expect(commands).toEqual(['/film', 'Synthetic Film', guids.toCatalogueShortId(filmId, 'Film')]);
        expect(commands[2]).not.toBe(filmId);
        expect(guids.parseCatalogueShortId(commands[2])).toEqual({ id: filmId, contentKind: 'Film' });
    });

    it('falls back to /search/{name} for a film with no id or a malformed id', () => {
        expect(suggestionCommands(s({ type: 'film', value: 'Synthetic Film' }))
            .toEqual(['/search', 'Synthetic Film']);
        expect(suggestionCommands(s({ type: 'film', value: 'Synthetic Film', itemId: 'not-a-guid' }))
            .toEqual(['/search', 'Synthetic Film']);
    });

    it('falls back to /search/{name} for an unknown kind', () => {
        const unknown = { type: 'person', value: 'Future Kind', label: 'Future Kind' } as unknown as Suggestion;
        expect(suggestionCommands(unknown)).toEqual(['/search', 'Future Kind']);
    });
});
