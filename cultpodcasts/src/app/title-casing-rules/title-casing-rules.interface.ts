export interface KnownTerm {
  literal: string;
  pattern: string;
  options?: string | null;
}

export interface LanguageTitleCasingRules {
  lowerCaseTerms: string[];
  knownTerms: KnownTerm[];
}

/** GET /title-casing-rules/{lang} and delta mutation responses */
export interface LanguageTitleCasingRulesResponse {
  language: string;
  lowerCaseTerms: string[];
  knownTerms: KnownTerm[];
  isDefault: boolean;
}
