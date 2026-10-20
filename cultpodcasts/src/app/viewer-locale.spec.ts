import { ApplicationRef, PLATFORM_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ViewerLocaleService, browserViewerLocale } from "./viewer-locale";

describe("viewer-locale", () => {
  describe("browserViewerLocale", () => {
    it("uses the first preferred language", () => {
      // Arrange
      const nav = { languages: ["es_ES", "en"], language: "en" };

      // Act
      const locale = browserViewerLocale(nav);

      // Assert
      expect(locale).toBe("es-ES");
    });

    it("falls back to the single browser language when there is no list", () => {
      // Arrange
      const nav = { languages: [] as readonly string[], language: "fr" };

      // Act
      const locale = browserViewerLocale(nav);

      // Assert
      expect(locale).toBe("fr");
    });

    it("falls back to English without a navigator or with an invalid tag", () => {
      // Arrange
      const invalid = { languages: ["not a locale!"], language: "" };

      // Act
      const withoutNavigator = browserViewerLocale(null);
      const withInvalidTag = browserViewerLocale(invalid);

      // Assert
      expect(withoutNavigator).toBe("en");
      expect(withInvalidTag).toBe("en");
    });
  });

  describe("ViewerLocaleService", () => {
    it("stays English on the server so rendered HTML matches the first client render", () => {
      // Arrange
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: "server" }]
      });
      const service = TestBed.inject(ViewerLocaleService);

      // Act
      TestBed.inject(ApplicationRef).tick();

      // Assert
      expect(service.locale()).toBe("en");
    });

    it("starts English in the browser and switches to the browser language after rendering", () => {
      // Arrange
      vi.spyOn(navigator, "languages", "get").mockReturnValue(["es-MX"]);
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: "browser" }]
      });
      const service = TestBed.inject(ViewerLocaleService);
      const beforeRender = service.locale();

      // Act
      TestBed.inject(ApplicationRef).tick();

      // Assert
      expect(beforeRender).toBe("en");
      expect(service.locale()).toBe("es-MX");
    });
  });
});
