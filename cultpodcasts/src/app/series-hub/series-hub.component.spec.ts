import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideZonelessChangeDetection } from "@angular/core";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { SeriesHubComponent } from "./series-hub.component";
import { ODataService } from "../odata.service";
import { PlayerService } from "../player.service";
import { SearchResult } from "../search-result.interface";

describe("SeriesHubComponent", () => {
  let oData: { getEntities: ReturnType<typeof vi.fn> };

  async function render(hub: "tv" | "news"): Promise<ComponentFixture<SeriesHubComponent>> {
    oData = {
      getEntities: vi.fn().mockReturnValue(of({
        status: 200,
        entities: [{
          id: "1",
          podcastName: "Nightly",
          episodeTitle: "One",
          episodeDescription: "Desc",
          release: new Date("2026-01-02T00:00:00Z"),
          duration: "01:00:00",
          contentKind: hub === "tv" ? "TvShowEpisode" : "NewsReport",
        } satisfies SearchResult],
        facets: {},
        count: 1,
      })),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SeriesHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ODataService, useValue: oData },
        { provide: PlayerService, useValue: { play: () => undefined } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SeriesHubComponent);
    fixture.componentRef.setInput("seriesName", "Nightly");
    fixture.componentRef.setInput("hub", hub);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it("filters the TV hub by TvShowEpisode and seriesName", async () => {
    await render("tv");
    expect(oData.getEntities.mock.calls[0][1].filter).toBe(
      "(contentKind eq 'TvShowEpisode') and (seriesName eq 'Nightly')"
    );
  });

  it("retries the TV hub on podcastName when seriesName is unknown", async () => {
    const unknown = new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: {} });
    oData = {
      getEntities: vi.fn()
        .mockReturnValueOnce(throwError(() => unknown))
        .mockReturnValue(of({ status: 200, entities: [], facets: {}, count: 0 })),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SeriesHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ODataService, useValue: oData },
        { provide: PlayerService, useValue: { play: () => undefined } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SeriesHubComponent);
    fixture.componentRef.setInput("seriesName", "Nightly");
    fixture.componentRef.setInput("hub", "tv");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(oData.getEntities.mock.calls[1][1].filter).toBe(
      "(contentKind eq 'TvShowEpisode') and (podcastName eq 'Nightly')"
    );
  });

  it("filters the news hub by NewsReport and seriesName", async () => {
    await render("news");
    expect(oData.getEntities.mock.calls[0][1].filter).toBe(
      "(contentKind eq 'NewsReport') and (seriesName eq 'Nightly')"
    );
  });
});
