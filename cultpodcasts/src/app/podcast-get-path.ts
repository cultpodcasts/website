import { EditPodcastDialogData } from "./edit-podcast-dialog-data.interface";

/**
 * GET /podcast path for curator edit dialogs.
 * Guid identifiers must hit GET /podcast/{id}. Name lookups may append episodeId
 * for disambiguation. encodeURIComponent so names with '+', '?', etc. stay in the path.
 */
export function isPodcastGuid(identifier: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
}

export function podcastGetPath(identifier: string, episodeId?: string): string {
  const encoded = encodeURIComponent(identifier);
  if (episodeId && !isPodcastGuid(identifier)) {
    return `/podcast/${encoded}/${episodeId}`;
  }
  return `/podcast/${encoded}`;
}

export function podcastGetPathFromEditData(data: EditPodcastDialogData): string {
  return podcastGetPath(data.podcastId ?? data.podcastName, data.episodeId);
}
