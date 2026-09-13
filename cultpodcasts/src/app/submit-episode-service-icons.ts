import { SubmitEpisodeDetails } from "./submit-episode-details.interface";
import { isDefaultUiService, serviceDescriptor } from "./service-catalog";

export type SubmitEpisodeServiceIconRow = {
  key: string;
  icon: string;
  displayName: string;
  usesAppleMark: boolean;
};

type SubmitEpisodeServiceIconSource = Pick<
  SubmitEpisodeDetails,
  "spotify" | "apple" | "youtube" | "extraServiceKeys"
>;

/**
 * Icon rows for the submit-success snackbar: named Spotify / Apple / YouTube flags,
 * then extra catalog keys. Default-UI keys in the extra bag are skipped so they
 * cannot double-render.
 */
export function submitEpisodeServiceIconRows(
  details: SubmitEpisodeServiceIconSource | null | undefined
): SubmitEpisodeServiceIconRow[] {
  if (!details) {
    return [];
  }

  const rows: SubmitEpisodeServiceIconRow[] = [];
  const pushDescriptor = (key: string, usesAppleMark: boolean) => {
    const descriptor = serviceDescriptor(key);
    rows.push({
      key: descriptor.key,
      icon: descriptor.icon,
      displayName: descriptor.displayName,
      usesAppleMark
    });
  };

  if (details.spotify) {
    pushDescriptor("spotify", false);
  }
  if (details.apple) {
    pushDescriptor("apple", true);
  }
  if (details.youtube) {
    pushDescriptor("youtube", false);
  }

  const seen = new Set(rows.map((row) => row.key));
  for (const key of details.extraServiceKeys ?? []) {
    if (!key || isDefaultUiService(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    pushDescriptor(key, false);
  }
  return rows;
}
