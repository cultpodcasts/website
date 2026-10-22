import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { CurationSubmitService } from './curation-submit.service';
import { EpisodeService } from './episode.service';

/**
 * Parent (news outlet / TV show) name for a playable guid, for Review links after a toolbar submit, where
 * the submit response has only `contentKind` + `playableId`. Tries the curator GET first (fresh from the
 * database, so it works before the search indexer has picked the new item up), then the search lookup.
 */
@Injectable({ providedIn: 'root' })
export class CataloguePlayableParentService {
  private readonly curation = inject(CurationSubmitService);
  private readonly episodes = inject(EpisodeService);

  async parentName(
    kind: CataloguePlayableKind.NewsReport | CataloguePlayableKind.TvShowEpisode,
    playableId: string
  ): Promise<string | null> {
    try {
      const name = kind === CataloguePlayableKind.NewsReport
        ? (await firstValueFrom(this.curation.getNewsReport(playableId))).newsOrganisationName
        : (await firstValueFrom(this.curation.getTvShowEpisode(playableId))).tvShowName;
      if (name?.trim()) {
        return name;
      }
    } catch {
      // Fall through to the search lookup.
    }
    try {
      const hit = await this.episodes.getPlayableById(playableId);
      return hit?.podcastName?.trim() ? hit.podcastName : null;
    } catch {
      return null;
    }
  }
}
