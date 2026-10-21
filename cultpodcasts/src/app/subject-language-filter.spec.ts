import {
  ALL_LANGUAGES_VALUE,
  ENGLISH_LANGUAGE_VALUE,
  availableLanguageChipValues,
  buildSubjectLangFilter,
  displayedLanguageOptions,
  englishFacetCount,
  languageLabel,
  languageSelectionIntersectsAvailable,
  reconcileLanguageChipsForPodcasts,
  selectionFromChipValues,
  shouldShowLanguageSelector
} from "./subject-language-filter";

describe("subject-language-filter", () => {
  it("defaults English to null plus exact legacy en (no startswith — Azure Search OData)", () => {
    expect(buildSubjectLangFilter({ mode: "english" }))
      .toBe(" and (lang eq null or lang eq 'en')");
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
      .toBe(" and ((lang eq null or lang eq 'en') or search.in(lang, 'es', ','))");
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

  it("folds legacy en facet counts into the English bucket", () => {
    expect(englishFacetCount(100, [{ value: "en", count: 10 }, { value: "fil", count: 40 }])).toBe(60);
  });

  describe("availableLanguageChipValues", () => {
    it("includes English when null-lang episodes remain after non-English facets", () => {
      expect(availableLanguageChipValues(100, [{ value: "fr", count: 40 }]))
        .toEqual([ENGLISH_LANGUAGE_VALUE, "fr"]);
    });

    it("omits English when all episodes have non-null lang codes", () => {
      expect(availableLanguageChipValues(10, [{ value: "fr", count: 10 }])).toEqual(["fr"]);
    });

    it("returns only English when there are no non-English facet buckets", () => {
      expect(availableLanguageChipValues(25, [])).toEqual([ENGLISH_LANGUAGE_VALUE]);
    });

    it("does not surface a second English chip for legacy en facets", () => {
      expect(availableLanguageChipValues(20, [{ value: "en", count: 5 }, { value: "fil", count: 8 }]))
        .toEqual([ENGLISH_LANGUAGE_VALUE, "fil"]);
    });
  });

  describe("languageSelectionIntersectsAvailable", () => {
    it("treats All as always intersecting", () => {
      expect(languageSelectionIntersectsAvailable({ mode: "all" }, [])).toBe(true);
      expect(languageSelectionIntersectsAvailable({ mode: "all" }, ["fr"])).toBe(true);
    });

    it("detects English-only filter with no English episodes", () => {
      expect(languageSelectionIntersectsAvailable({ mode: "english" }, ["fr"])).toBe(false);
      expect(languageSelectionIntersectsAvailable(
        { mode: "english" },
        [ENGLISH_LANGUAGE_VALUE, "fr"]
      )).toBe(true);
    });

    it("requires at least one selected code to be available", () => {
      expect(languageSelectionIntersectsAvailable({ mode: "codes", codes: ["es"] }, ["fr"]))
        .toBe(false);
      expect(languageSelectionIntersectsAvailable({ mode: "codes", codes: ["es", "fr"] }, ["fr"]))
        .toBe(true);
      expect(languageSelectionIntersectsAvailable(
        { mode: "englishAndCodes", codes: ["es"] },
        ["fr"]
      )).toBe(false);
      expect(languageSelectionIntersectsAvailable(
        { mode: "englishAndCodes", codes: ["es"] },
        [ENGLISH_LANGUAGE_VALUE]
      )).toBe(true);
    });
  });

  describe("reconcileLanguageChipsForPodcasts", () => {
    it("widens to All when English has no intersection with a French-only show", () => {
      expect(reconcileLanguageChipsForPodcasts({ mode: "english" }, ["fr"]))
        .toEqual([ALL_LANGUAGES_VALUE]);
    });

    it("widens to All when default English finds no episodes but Spanish facets exist", () => {
      // Subject page: English preference, Spanish-only subject (e.g. Edelweiss).
      expect(reconcileLanguageChipsForPodcasts({ mode: "english" }, ["es"]))
        .toEqual([ALL_LANGUAGES_VALUE]);
      expect(availableLanguageChipValues(12, [{ value: "es", count: 12 }])).toEqual(["es"]);
    });

    it("does not switch to the show's specific language codes", () => {
      expect(reconcileLanguageChipsForPodcasts({ mode: "codes", codes: ["es"] }, ["fr"]))
        .toEqual([ALL_LANGUAGES_VALUE]);
      expect(reconcileLanguageChipsForPodcasts({ mode: "codes", codes: ["es"] }, ["fr"]))
        .not.toEqual(["fr"]);
    });

    it("keeps the selection when it still intersects available languages", () => {
      expect(reconcileLanguageChipsForPodcasts(
        { mode: "english" },
        [ENGLISH_LANGUAGE_VALUE, "fr"]
      )).toBeNull();
      expect(reconcileLanguageChipsForPodcasts({ mode: "all" }, ["fr"])).toBeNull();
      expect(reconcileLanguageChipsForPodcasts({ mode: "codes", codes: ["fr"] }, ["fr"]))
        .toBeNull();
    });

    it("leaves selection alone when the show has no language facets", () => {
      expect(reconcileLanguageChipsForPodcasts({ mode: "english" }, [])).toBeNull();
    });
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

    it("hides legacy en facet buckets so English is not duplicated", () => {
      expect(displayedLanguageOptions(
        [{ value: "en", count: 2 }, { value: "fil", count: 5 }],
        { mode: "english" })).toEqual([{ value: "fil", count: 5 }]);
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
    it("names the language for an English viewer, then in its own language", () => {
      // Arrange
      const codes = ["es", "de", "fr", "ro", "cs"];

      // Act
      const labels = codes.map(code => languageLabel(code, "en"));

      // Assert
      expect(labels).toEqual([
        "Spanish (Español)",
        "German (Deutsch)",
        "French (Français)",
        "Romanian (Română)",
        "Czech (Čeština)"
      ]);
    });

    it("uses English for the viewer when no viewer locale is given", () => {
      // Arrange
      const code = "es";

      // Act
      const label = languageLabel(code);

      // Assert
      expect(label).toBe("Spanish (Español)");
    });

    it("names the language in a Spanish viewer's language, capitalised", () => {
      // Arrange
      const codes = ["en", "fr"];

      // Act
      const labels = codes.map(code => languageLabel(code, "es"));

      // Assert
      expect(labels).toEqual(["Inglés (English)", "Francés (Français)"]);
    });

    it("shows a single name when the viewer's name and the native name match", () => {
      // Arrange
      const englishForEnglishViewer = { code: "en", viewer: "en" };
      const spanishForSpanishViewer = { code: "es", viewer: "es-MX" };

      // Act
      const english = languageLabel(englishForEnglishViewer.code, englishForEnglishViewer.viewer);
      const spanish = languageLabel(spanishForSpanishViewer.code, spanishForSpanishViewer.viewer);
      const afrikaans = languageLabel("af", "en");

      // Assert
      expect(english).toBe("English");
      expect(spanish).toBe("Español");
      expect(afrikaans).toBe("Afrikaans");
    });

    it("names a language that is not in any hand-written list", () => {
      // Arrange
      const code = "ki";

      // Act
      const label = languageLabel(code, "en");

      // Assert
      expect(label).toBe("Kikuyu (Gikuyu)");
    });

    it("resolves region subtags to the base language", () => {
      // Arrange
      const codes = ["pt-BR", "pt_BR", "PT"];

      // Act
      const labels = codes.map(code => languageLabel(code, "en"));

      // Assert
      expect(labels).toEqual([
        "Portuguese (Português)",
        "Portuguese (Português)",
        "Portuguese (Português)"
      ]);
    });

    it("falls back to English when the viewer locale is not a valid tag", () => {
      // Arrange
      const viewer = "not a locale!";

      // Act
      const label = languageLabel("ti", viewer);

      // Assert
      expect(label).toBe("Tigrinya (ትግርኛ)");
    });

    it("returns the same label when asked again", () => {
      // Arrange
      const first = languageLabel("de", "es");

      // Act
      const second = languageLabel("de", "es");

      // Assert
      expect(second).toBe(first);
      expect(second).toBe("Alemán (Deutsch)");
    });

    it("falls back to the raw code when the language cannot be named", () => {
      // Arrange
      const codes = ["zz", "not a lang code!", ""];

      // Act
      const labels = codes.map(code => languageLabel(code, "en"));

      // Assert
      expect(labels).toEqual(["zz", "not a lang code!", ""]);
    });
  });
});
