import {
  ALL_LANGUAGES_VALUE,
  ENGLISH_LANGUAGE_VALUE,
  buildSubjectLangFilter,
  displayedLanguageOptions,
  englishFacetCount,
  languageLabel,
  selectionFromChipValues,
  shouldShowLanguageSelector
} from "./subject-language-filter";

describe("subject-language-filter", () => {
  it("defaults English to lang eq null", () => {
    expect(buildSubjectLangFilter({ mode: "english" })).toBe(" and lang eq null");
    expect(selectionFromChipValues([])).toEqual({ mode: "english" });
    expect(selectionFromChipValues([ENGLISH_LANGUAGE_VALUE])).toEqual({ mode: "english" });
  });

  it("builds exact and search.in filters for non-English codes", () => {
    expect(buildSubjectLangFilter({ mode: "codes", codes: ["es"] })).toBe(" and lang eq 'es'");
    expect(buildSubjectLangFilter({ mode: "codes", codes: ["es", "fr"] }))
      .toBe(" and search.in(lang, 'es,fr', ',')");
  });

  it("supports English plus other codes and all-languages", () => {
    expect(buildSubjectLangFilter({ mode: "englishAndCodes", codes: ["es"] }))
      .toBe(" and (lang eq null or search.in(lang, 'es', ','))");
    expect(buildSubjectLangFilter({ mode: "all" })).toBe("");
    expect(selectionFromChipValues([ALL_LANGUAGES_VALUE])).toEqual({ mode: "all" });
  });

  it("allows non-English-only selection after English is deselected", () => {
    expect(selectionFromChipValues([ENGLISH_LANGUAGE_VALUE, "pt"]))
      .toEqual({ mode: "englishAndCodes", codes: ["pt"] });
    expect(selectionFromChipValues(["pt"])).toEqual({ mode: "codes", codes: ["pt"] });
    expect(selectionFromChipValues(["es", "pt"]))
      .toEqual({ mode: "codes", codes: ["es", "pt"] });
  });

  it("synthesizes English count from omitted null facet buckets", () => {
    expect(englishFacetCount(100, [{ value: "es", count: 30 }, { value: "fr", count: 20 }])).toBe(50);
  });

  describe("shouldShowLanguageSelector", () => {
    it("hides the selector when facets contain only English/default results", () => {
      expect(shouldShowLanguageSelector(undefined, { mode: "english" })).toBe(false);
      expect(shouldShowLanguageSelector([], { mode: "english" })).toBe(false);
      expect(shouldShowLanguageSelector([{ value: "es", count: 0 }], { mode: "english" })).toBe(false);
    });

    it("shows the selector when non-English buckets have counts", () => {
      expect(shouldShowLanguageSelector([{ value: "es", count: 3 }], { mode: "english" })).toBe(true);
      expect(shouldShowLanguageSelector(
        [{ value: "es", count: 3 }, { value: "fr", count: 1 }],
        { mode: "english" })).toBe(true);
    });

    it("keeps the selector visible while a non-default selection is active", () => {
      expect(shouldShowLanguageSelector([], { mode: "codes", codes: ["es"] })).toBe(true);
      expect(shouldShowLanguageSelector(undefined, { mode: "englishAndCodes", codes: ["es"] })).toBe(true);
      expect(shouldShowLanguageSelector([], { mode: "all" })).toBe(true);
    });
  });

  describe("displayedLanguageOptions", () => {
    it("passes through facet buckets with counts", () => {
      expect(displayedLanguageOptions([{ value: "es", count: 3 }], { mode: "english" }))
        .toEqual([{ value: "es", count: 3 }]);
    });

    it("drops zero-count buckets", () => {
      expect(displayedLanguageOptions(
        [{ value: "es", count: 3 }, { value: "fr", count: 0 }],
        { mode: "english" })).toEqual([{ value: "es", count: 3 }]);
    });

    it("keeps actively selected codes visible when missing from facets", () => {
      expect(displayedLanguageOptions([], { mode: "codes", codes: ["es"] }))
        .toEqual([{ value: "es", count: 0 }]);
      expect(displayedLanguageOptions(
        [{ value: "fr", count: 2 }],
        { mode: "englishAndCodes", codes: ["es"] }))
        .toEqual([{ value: "fr", count: 2 }, { value: "es", count: 0 }]);
    });
  });

  describe("languageLabel", () => {
    it("shows English name with local name when they differ", () => {
      expect(languageLabel("es")).toBe("Spanish (Español)");
      expect(languageLabel("de")).toBe("German (Deutsch)");
      expect(languageLabel("fr")).toBe("French (Français)");
      expect(languageLabel("ro")).toBe("Romanian (Română)");
    });

    it("shows the name once when English and local names match", () => {
      expect(languageLabel("en")).toBe("English");
      expect(languageLabel("af")).toBe("Afrikaans");
    });

    it("resolves region subtags to the base language entry", () => {
      expect(languageLabel("pt-BR")).toBe("Portuguese (Português)");
    });

    it("falls back to the raw code for unknown codes", () => {
      expect(languageLabel("zz")).toBe("zz");
      expect(languageLabel("not a lang code!")).toBe("not a lang code!");
      expect(languageLabel("")).toBe("");
    });
  });
});
