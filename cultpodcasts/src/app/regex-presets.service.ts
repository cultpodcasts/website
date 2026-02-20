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
    };
  }

  resolveRegexPlaceholders(regexValue: string, podcastName: string): string {
    return regexValue.replaceAll("{podcastName}", podcastName);
  }

  applyTitleRegexPreset(pattern: string, control: FormControl<string>, podcastName: string): void {
    control.setValue(this.resolveRegexPlaceholders(pattern, podcastName));
  }

  applyDescriptionRegexPreset(pattern: string, control: FormControl<string>, podcastName: string): void {
    control.setValue(this.resolveRegexPlaceholders(pattern, podcastName));
  }
}