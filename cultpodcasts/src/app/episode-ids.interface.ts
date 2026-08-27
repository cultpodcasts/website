/** Spotify / Apple / YouTube identity. Presence of a reconstructable service lives here. */
export interface EpisodeIds {
  spotify?: string | null;
  apple?: number | string | null;
  youtube?: string | null;
}
