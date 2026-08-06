export interface SupportedLanguage {
  code: string;
  name: string;
}

export interface SupportedLanguagesResponse {
  languages: SupportedLanguage[];
  isDefault: boolean;
}

export interface SupportedLanguagesUpdate {
  languages: SupportedLanguage[];
}
