import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { CurationSubmitService } from './curation-submit.service';
import { EpisodeService } from './episode.service';

/**
 * Parent (news outlet / TV show) name for a playable guid, or for a film its own name (the /film/{name} slug), for Review links after a toolbar submit, where
 * the submit response has only `contentKind` + `playableId`. Tries the curator GET first (fresh from the
 * database, so it works before the search indexer has picked the new item up), then the search lookup.
 */
@Injectable({ providedIn: 'root' })
export class CataloguePlayableParentService {
  private readonly curation = inject(CurationSubmitService);
  private readonly episodes = inject(EpisodeService);

  async parentName(
    kind: CataloguePlayableKind.NewsReport | CataloguePlayableKind.TvShowEpisode | CataloguePlayableKind.Film,
    playableId: string
  ): Promise<string | null> {
    try {
      const name = kind === CataloguePlayableKind.NewsReport
        ? (await firstValueFrom(this.curation.getNewsReport(playableId))).newsOrganisationName
        : kind === CataloguePlayableKind.Film
          ? (await firstValueFrom(this.curation.getFilm(playableId))).name
          : (await firstValueFrom(this.curation.getTvShowEpisode(playableId))).tvShowName;
      if (name?.trim()) {
        return name;
      }
    } catch {
      // Fall through to the search lookup.
    }
    try {
      const hit = await this.episodes.getPlayableById(playableId);
      // A film's page slug is its own title (cataloguePlayableLink); news / TV use the parent name.
      const name = kind === CataloguePlayableKind.Film ? hit?.episodeTitle : hit?.podcastName;
      return name?.trim() ? name : null;
    } catch {
      return null;
    }
  }
}
