import { LanguageDisplayNamesFactory, createLanguageLabeler } from "./languages";

/**
 * Simulates a runtime with trimmed ICU data (as in Chromium / workerd): only
 * the listed locales have their own data; any other locale silently answers in
 * English, and codes missing from `known` come back as the code itself.
 */
function trimmedIcu(localesWithData: string[], known: Record<string, Record<string, string>>): LanguageDisplayNamesFactory {
  return locale => {
    const effective = localesWithData.includes(locale) ? locale : "en-US";
    const table = known[effective.split("-")[0]] ?? {};
    return {
      of: (code: string) => table[code] ?? code,
      resolvedOptions: () => ({ locale: effective })
    } as unknown as Intl.DisplayNames;
  };
}

const fakeRuntime = trimmedIcu(["en", "es", "xa"], {
  en: { xa: "Alphaish", xb: "Betaish", xc: "Gammaish" },
  es: { xa: "alfaés", xb: "betaés" },
  xa: { xa: "alphaland" }
});

describe("languages", () => {
  it("uses the runtime's names when it has data for both languages", () => {
    // Arrange
    const label = createLanguageLabeler(fakeRuntime, {});

    // Act
    const forEnglishViewer = label("xa", "en");
    const forSpanishViewer = label("xa", "es");

    // Assert
    expect(forEnglishViewer).toBe("Alphaish (Alphaland)");
    expect(forSpanishViewer).toBe("Alfaés (Alphaland)");
  });

  it("drops the native name when the runtime only falls back to English for it", () => {
    // Arrange
    const label = createLanguageLabeler(fakeRuntime, {});

    // Act
    const forSpanishViewer = label("xb", "es");

    // Assert
    expect(forSpanishViewer).toBe("Betaés");
  });

  it("fills a missing native name from the supplementary names", () => {
    // Arrange
    const label = createLanguageLabeler(fakeRuntime, { xb: { native: "betalingo" } });

    // Act
    const forEnglishViewer = label("xb", "en");

    // Assert
    expect(forEnglishViewer).toBe("Betaish (Betalingo)");
  });

  it("names a language the runtime does not know from the supplementary names", () => {
    // Arrange
    const label = createLanguageLabeler(fakeRuntime, { xd: { english: "Deltaish", native: "deltalingo" } });

    // Act
    const forSpanishViewer = label("xd", "es");

    // Assert
    expect(forSpanishViewer).toBe("Deltaish (Deltalingo)");
  });

  it("falls back to the raw code when neither the runtime nor the supplement can name it", () => {
    // Arrange
    const label = createLanguageLabeler(fakeRuntime, {});

    // Act
    const unknown = label("xz", "en");

    // Assert
    expect(unknown).toBe("xz");
  });

  it("returns the raw code when Intl is unavailable", () => {
    // Arrange
    const label = createLanguageLabeler(() => null, {});

    // Act
    const result = label("xa", "en");

    // Assert
    expect(result).toBe("xa");
  });

  it("asks the runtime once per locale and language", () => {
    // Arrange
    let created = 0;
    const counting: LanguageDisplayNamesFactory = locale => {
      created++;
      return fakeRuntime(locale);
    };
    const label = createLanguageLabeler(counting, {});

    // Act
    label("xa", "en");
    label("xa", "en");
    label("xa-YY", "en");

    // Assert
    expect(created).toBe(2);
  });
});
