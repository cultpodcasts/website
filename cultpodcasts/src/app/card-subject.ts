import { isMetaSubject } from './obscure-cults';

/**
 * The one subject to show on an episode card, so a card is never left with only a title
 * and a show name to explain what the episode is about.
 *
 * `exclude` is for subject-scoped views (a subject page, or a "More on X" rail) where the
 * surrounding heading already names that subject — the chip should add something new.
 */
export function pickCardSubject(
  subjects: readonly string[] | undefined,
  exclude?: string
): string | undefined {
  const excluded = exclude?.trim().toLowerCase();
  const candidates = (subjects ?? []).filter(
    (subject) =>
      !!subject && !subject.startsWith('_') && subject.trim().toLowerCase() !== excluded
  );

  // A named group is more informative than a topic tag, but a topic tag beats showing nothing.
  return candidates.find((subject) => !isMetaSubject(subject)) ?? candidates[0];
}
