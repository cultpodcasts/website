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
   * Resolves the client-side `{podcastName}` placeholder only: a one-off, apply-time,
   * **unescaped** substitution of the current podcast name, kept for the title preset.
   *
   * Server-side description tokens (`{podcast-name}`, `{episode-title}`) are deliberately
   * left untouched so they reach the Api verbatim, where they are escaped and resolved
   * per episode (RedditPodcastPoster `docs/description-regex-tokens.md`). Do not resolve
   * them here, and use them rather than `{podcastName}` in new description presets.
   */
  resolveRegexPlaceholders(regexValue: string, podcastName: string): string {
    return regexValue.replaceAll("{podcastName}", podcastName);
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
