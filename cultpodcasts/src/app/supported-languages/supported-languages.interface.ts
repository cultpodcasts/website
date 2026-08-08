export interface SupportedLanguage {
  code: string;
  name: string;
}

export interface SupportedLanguagesResponse {
  languages: SupportedLanguage[];
  isDefault: boolean;
}

/** Code may be empty on add — the API derives it from the language name. */
export interface SupportedLanguageUpdate {
  code: string;
  name: string;
}

export interface SupportedLanguagesUpdate {
  languages: SupportedLanguageUpdate[];
}
