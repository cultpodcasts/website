export interface SupportedLanguage {
  code: string;
  name: string;
}

export interface SupportedLanguagesResponse {
  languages: SupportedLanguage[];
  isDefault: boolean;
}

export interface SupportedLanguageAdd {
  name: string;
}

export interface NeutralCulture {
  code: string;
  name: string;
}

export interface NeutralCulturesResponse {
  cultures: NeutralCulture[];
}
