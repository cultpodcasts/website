export interface KnownTerm {
  literal: string;
  pattern: string;
  options?: string | null;
}

export interface LanguageTitleCasingRules {
  lowerCaseTerms: string[];
  knownTerms: KnownTerm[];
}

/** GET/PUT /title-casing-rules/{lang} */
export interface LanguageTitleCasingRulesResponse {
  language: string;
  lowerCaseTerms: string[];
  knownTerms: KnownTerm[];
  isDefault: boolean;
}

export interface LanguageTitleCasingRulesUpdate {
  lowerCaseTerms: string[];
  knownTerms: KnownTerm[];
}
