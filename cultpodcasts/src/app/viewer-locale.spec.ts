import { PLATFORM_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SERVER_VIEWER_LOCALE, ViewerLocaleService, firstAcceptLanguage } from "./viewer-locale";

describe("viewer-locale", () => {
  describe("firstAcceptLanguage", () => {
    it("takes the first tag without its quality weight", () => {
      // Arrange
      const header = "es-ES;q=1.0,es;q=0.9,en;q=0.8";

      // Act
      const locale = firstAcceptLanguage(header);

      // Assert
      expect(locale).toBe("es-ES");
    });

    it("has no locale for a missing, empty or wildcard header", () => {
      // Arrange
      const headers = [null, undefined, "", "*"];

      // Act
      const locales = headers.map(firstAcceptLanguage);

      // Assert
      expect(locales).toEqual([undefined, undefined, undefined, undefined]);
    });
  });

  describe("ViewerLocaleService on the server", () => {
    it("uses the request locale provided for server rendering", () => {
      // Arrange
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: "server" },
          { provide: SERVER_VIEWER_LOCALE, useValue: "es_ES" }
        ]
      });

      // Act
      const locale = TestBed.inject(ViewerLocaleService).locale;

      // Assert
      expect(locale).toBe("es-ES");
    });

    it("uses English when no request locale is provided, as in prerender", () => {
      // Arrange
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: "server" }]
      });

      // Act
      const locale = TestBed.inject(ViewerLocaleService).locale;

      // Assert
      expect(locale).toBe("en");
    });
  });

  describe("ViewerLocaleService in the browser", () => {
    it("uses the browser's preferred language", () => {
      // Arrange
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: "browser" }]
      });

      // Act
      const locale = TestBed.inject(ViewerLocaleService).locale;

      // Assert
      expect(locale).toBe(Intl.getCanonicalLocales(navigator.languages?.[0] ?? navigator.language)[0]);
    });
  });
});
