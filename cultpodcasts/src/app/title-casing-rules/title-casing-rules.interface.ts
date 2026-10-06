export interface KnownTerm {
  literal: string;
  pattern: string;
  options?: string | null;
}

export interface LanguageTitleCasingRules {
  lowerCaseTerms: string[];
  knownTerms: KnownTerm[];
}

/** GET /title-casing-rules/{lang}. Commands on this resource acknowledge with 202 and no body. */
export interface LanguageTitleCasingRulesResponse {
  language: string;
  lowerCaseTerms: string[];
  knownTerms: KnownTerm[];
  isDefault: boolean;
  ignoredSubjects?: string[];
}
