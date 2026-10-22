import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { CataloguePlayableParentService } from './catalogue-playable-parent.service';
import { CurationSubmitService } from './curation-submit.service';
import { EpisodeService } from './episode.service';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('CataloguePlayableParentService', () => {
  let curation: { getNewsReport: ReturnType<typeof vi.fn>; getTvShowEpisode: ReturnType<typeof vi.fn> };
  let episodes: { getPlayableById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    curation = { getNewsReport: vi.fn(), getTvShowEpisode: vi.fn() };
    episodes = { getPlayableById: vi.fn(async () => undefined) };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: CurationSubmitService, useValue: curation },
        { provide: EpisodeService, useValue: episodes }
      ]
    });
  });

  it('uses the curator GET (fresh, before the search index has the new item)', async () => {
    curation.getNewsReport.mockReturnValue(of({ id, newsOrganisationName: 'Desk' }));
    curation.getTvShowEpisode.mockReturnValue(of({ id, tvShowName: 'Nightly' }));
    const service = TestBed.inject(CataloguePlayableParentService);
    expect(await service.parentName(CataloguePlayableKind.NewsReport, id)).toBe('Desk');
    expect(await service.parentName(CataloguePlayableKind.TvShowEpisode, id)).toBe('Nightly');
    expect(episodes.getPlayableById).not.toHaveBeenCalled();
  });

  it('falls back to the playable-by-id search lookup, then null', async () => {
    curation.getNewsReport.mockReturnValue(throwError(() => new Error('401')));
    episodes.getPlayableById.mockResolvedValueOnce({ id, podcastName: 'Desk' });
    const service = TestBed.inject(CataloguePlayableParentService);
    expect(await service.parentName(CataloguePlayableKind.NewsReport, id)).toBe('Desk');
    expect(await service.parentName(CataloguePlayableKind.NewsReport, id)).toBeNull();
  });
});
