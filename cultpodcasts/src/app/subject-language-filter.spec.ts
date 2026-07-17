import {
  ALL_LANGUAGES_VALUE,
  ENGLISH_LANGUAGE_VALUE,
  buildSubjectLangFilter,
  englishFacetCount,
  languageLabel,
  selectionFromChipValues
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

  it("synthesizes English count from omitted null facet buckets", () => {
    expect(englishFacetCount(100, [{ value: "es", count: 30 }, { value: "fr", count: 20 }])).toBe(50);
  });

  describe("languageLabel", () => {
    it("shows English name with capitalized endonym when they differ", () => {
      expect(languageLabel("es")).toBe("Spanish (Español)");
      expect(languageLabel("de")).toBe("German (Deutsch)");
      expect(languageLabel("fr")).toBe("French (Français)");
    });

    it("shows the name once when English name and endonym match", () => {
      expect(languageLabel("en")).toBe("English");
    });

    it("handles region subtags", () => {
      const label = languageLabel("pt-BR");
      expect(label).toContain("Portuguese");
      expect(label).toContain("Português");
    });

    it("falls back to the raw code for unknown or malformed codes", () => {
      expect(languageLabel("zz")).toBe("zz");
      expect(languageLabel("not a lang code!")).toBe("not a lang code!");
      expect(languageLabel("")).toBe("");
    });
  });
});
