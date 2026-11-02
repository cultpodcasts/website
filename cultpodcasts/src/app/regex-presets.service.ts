import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { RegexPresets } from './regex-presets.interface';
import regexPresetsJson from '../assets/regex-presets.json';

@Injectable({ providedIn: 'root' })
export class RegexPresetsService {
  loadRegexPresets(): RegexPresets {
    const presets = regexPresetsJson as Partial<RegexPresets>;
    return {
      title: presets.title ?? [],
      description: presets.description ?? [],
      includeTitle: presets.includeTitle ?? [],
    };
  }

  /**
   * Resolves the client-side `{podcastName}` placeholder only: a one-off, apply-time
   * substitution of the current podcast name, escaped so TitleRegex metacharacters in the
   * name stay literal in the saved pattern.
   *
   * Server-side description tokens (`{podcast-name}`, `{episode-title}`) are deliberately
   * left untouched so they reach the Api verbatim, where they are escaped and resolved
   * per episode (RedditPodcastPoster `docs/description-regex-tokens.md`). Do not resolve
   * them here, and use them rather than `{podcastName}` in new description presets.
   *
   * Uses a function replacer so JS string-replacement patterns (`$&`, `$``, `$'`) in the
   * escaped name are not reinterpreted by `replaceAll`.
   */
  resolveRegexPlaceholders(regexValue: string, podcastName: string): string {
    return regexValue.replaceAll("{podcastName}", () => escapeRegexLiteral(podcastName));
  }

  applyTitleRegexPreset(pattern: string, control: FormControl<string>, podcastName: string): void {
    control.setValue(this.resolveRegexPlaceholders(pattern, podcastName));
  }

  applyDescriptionRegexPreset(pattern: string, control: FormControl<string>, podcastName: string): void {
    control.setValue(this.resolveRegexPlaceholders(pattern, podcastName));
  }

  applyIncludeTitleRegexPreset(pattern: string, control: FormControl<string>, podcastName: string): void {
    control.setValue(this.resolveRegexPlaceholders(pattern, podcastName));
  }
}

/**
 * Escapes characters that are special in a TitleRegex (compiled server-side with
 * `new Regex(...)` without `IgnorePatternWhitespace`).
 *
 * Intentional subset of .NET `Regex.Escape`: `#` and whitespace are not escaped, because
 * TitleRegex does not use `(?x)` / `IgnorePatternWhitespace`. Do not reuse this helper for
 * DescriptionRegex / `(?x)` contexts where .NET escapes those too.
 */
export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
