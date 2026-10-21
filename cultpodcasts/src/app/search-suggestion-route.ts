import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { catalogueParentHubCommands, filmPageCommands } from './catalogue-links';
import { Suggestion } from './search-suggestions.interface';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Material icon ligature per suggestion kind. Unknown kinds use the search icon. */
export function suggestionIcon(type: string): string {
  switch (type) {
    case 'podcast':
      return 'podcasts';
    case 'tvShow':
      return 'live_tv';
    case 'newsOrganisation':
      return 'newspaper';
    case 'film':
      return 'movie';
    case 'subject':
      return 'sell';
    default:
      return 'search';
  }
}

/** Screen-reader kind label shown next to the icon. */
export function suggestionKindLabel(type: string): string {
  switch (type) {
    case 'podcast':
      return 'Podcast';
    case 'tvShow':
      return 'TV show';
    case 'newsOrganisation':
      return 'News outlet';
    case 'film':
      return 'Film';
    case 'subject':
      return 'Subject';
    default:
      return 'Search';
  }
}

/**
 * Router commands for a picked suggestion.
 * Podcast → /podcast/{name}; subject → /subject/{name}; TV → /tv/{name};
 * news → /news/{name}; film → /film/{name}/{Film-prefixed short id} via filmPageCommands
 * (never the raw guid). Unknown kinds, or a film without a guid id, fall back to /search/{name}.
 */
export function suggestionCommands(suggestion: Suggestion): string[] {
  switch (suggestion.type) {
    case 'podcast':
      return ['/podcast/' + suggestion.value];
    case 'subject':
      return ['/subject/' + suggestion.value];
    case 'tvShow':
      return catalogueParentHubCommands(CatalogueParentKind.TvShow, suggestion.value)
        ?? searchCommands(suggestion);
    case 'newsOrganisation':
      return catalogueParentHubCommands(CatalogueParentKind.NewsOrganisation, suggestion.value)
        ?? searchCommands(suggestion);
    case 'film':
      if (suggestion.itemId && GUID_PATTERN.test(suggestion.itemId) && suggestion.value) {
        return filmPageCommands(suggestion.value, suggestion.itemId);
      }
      return searchCommands(suggestion);
    default:
      return searchCommands(suggestion);
  }
}

function searchCommands(suggestion: Suggestion): string[] {
  return ['/search', suggestion.value];
}
