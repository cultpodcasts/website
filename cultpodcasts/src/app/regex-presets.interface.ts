/**
 * A named regex shown in the Title Regex / Description Regex / Episode Include Title Regex
 * drop-downs (`src/assets/regex-presets.json`).
 *
 * Two placeholder families exist and they behave differently:
 *
 * - `{podcastName}` is **client-side**. `RegexPresetsService.resolveRegexPlaceholders`
 *   replaces it once, when the curator picks the preset, with the **raw, unescaped**
 *   podcast name, so the name is frozen into the saved pattern and any regex
 *   metacharacters in it (`.`, `(`, `?`, `|`, `+`, `[`) become regex syntax.
 *   It is kept for **title** presets only.
 * - `{podcast-name}` and `{episode-title}` are **server-side** tokens. They are stored
 *   verbatim and resolved by the Api **per episode**, `Regex.Escape`d and tolerant of
 *   dash, quote and whitespace variants. They are only recognised in **DescriptionRegex**.
 *   Description presets must use these, and they must never be resolved client-side.
 *   See RedditPodcastPoster `docs/description-regex-tokens.md`.
 */
export interface NamedRegexPreset {
  name: string;
  pattern: string;
}

export interface RegexPresets {
  title: NamedRegexPreset[];
  description: NamedRegexPreset[];
  /** Episode include-title filters (keep matching titles; used as EpisodeIncludeTitleRegex). */
  includeTitle: NamedRegexPreset[];
}
