export interface NamedRegexPreset {
  name: string;
  pattern: string;
}

export interface RegexPresets {
  title: NamedRegexPreset[];
  description: NamedRegexPreset[];
}
