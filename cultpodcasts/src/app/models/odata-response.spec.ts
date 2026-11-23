import { HttpResponse } from '@angular/common/http';
import { SearchEngine } from '../search-engine.enum';
import { ODataEntitiesResponse, ODataEntitiesWithFacetsResponse } from './odata-response';

describe('ODataEntitiesResponse', () => {
  it('stamps searchEngine azure on each entity when the envelope has no engine', () => {
    const response = new HttpResponse({
      status: 200,
      body: { value: [{ id: '1', episodeDescription: 'Desc' }] }
    });
    const parsed = new ODataEntitiesResponse<{ id: string; episodeDescription: string; searchEngine?: SearchEngine }>(response);
    expect(parsed.searchEngine).toBe(SearchEngine.Azure);
    expect(parsed.entities).toEqual([
      { id: '1', episodeDescription: 'Desc', searchEngine: SearchEngine.Azure }
    ]);
  });

  it('stamps searchEngine d1 on each entity when the envelope says d1', () => {
    const response = new HttpResponse({
      status: 200,
      body: { '@search.engine': 'd1', value: [{ id: '1' }, { id: '2' }] }
    });
    const parsed = new ODataEntitiesResponse<{ id: string; searchEngine?: SearchEngine }>(response);
    expect(parsed.searchEngine).toBe(SearchEngine.D1);
    expect(parsed.entities.map(e => e.searchEngine)).toEqual([SearchEngine.D1, SearchEngine.D1]);
  });

  it('still reads facets from @search.facets when the engine field is present', () => {
    const response = new HttpResponse({
      status: 200,
      body: {
        '@search.engine': 'd1',
        '@search.facets': { subjects: [{ value: 'Cults', count: 1 }] },
        value: []
      }
    });
    const parsed = new ODataEntitiesWithFacetsResponse(response);
    expect(parsed.searchEngine).toBe(SearchEngine.D1);
    expect(parsed.facets.subjects?.[0].value).toBe('Cults');
  });
});
