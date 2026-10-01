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
  let oData: { getEntitiesWithFacets: ReturnType<typeof vi.fn> };

  function page(overrides?: {
    entities?: SearchResult[];
    count?: number;
    subjects?: { value: string; count: number }[];
  }) {
    const entities = overrides?.entities ?? [{
      id: "1",
      podcastName: "Nightly",
      episodeTitle: "One",
      episodeDescription: "Desc",
      release: new Date("2026-01-02T00:00:00Z"),
      duration: "01:00:00",
      contentKind: "TvShowEpisode",
    } satisfies SearchResult];
    return {
      status: 200,
      metadata: new Map<string, number>([["count", overrides?.count ?? entities.length]]),
      entities,
      facets: { subjects: overrides?.subjects ?? [{ value: "World", count: 2 }] },
    };
  }

  async function render(hub: "tv" | "news"): Promise<ComponentFixture<SeriesHubComponent>> {
    oData = {
      getEntitiesWithFacets: vi.fn().mockReturnValue(of(page({
        entities: [{
          id: "1",
          podcastName: "Nightly",
          episodeTitle: "One",
          episodeDescription: "Desc",
          release: new Date("2026-01-02T00:00:00Z"),
          duration: "01:00:00",
          contentKind: hub === "tv" ? "TvShowEpisode" : "NewsReport",
        }],
      }))),
    };
    return createHub(hub);
  }

  async function createHub(hub: "tv" | "news"): Promise<ComponentFixture<SeriesHubComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SeriesHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ODataService, useValue: oData },
        {
          provide: PlayerService,
          useValue: { play: () => undefined, episode: () => undefined, mode: () => "dock" },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SeriesHubComponent);
    fixture.componentRef.setInput("seriesName", "Nightly");
    fixture.componentRef.setInput("hub", hub);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function renderWithSearch(respond: ReturnType<typeof vi.fn>): Promise<ComponentFixture<SeriesHubComponent>> {
    oData = { getEntitiesWithFacets: respond };
    return createHub("tv");
  }

  function unknownField(name: string): HttpErrorResponse {
    return new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: `Invalid expression: Could not find a property named '${name}' on type 'search.document'.`,
        },
      },
    });
  }

  it("filters the TV hub by TvShowEpisode and seriesName", async () => {
    await render("tv");
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].filter).toBe(
      "(contentKind eq 'TvShowEpisode') and (seriesName eq 'Nightly')"
    );
  });

  it("retries the TV hub on podcastName when seriesName is unknown", async () => {
    await renderWithSearch(vi.fn()
      .mockReturnValueOnce(throwError(() => unknownField("seriesName")))
      .mockReturnValue(of(page({ entities: [], count: 0, subjects: [] }))));
    expect(oData.getEntitiesWithFacets.mock.calls[1][1].filter).toBe(
      "(contentKind eq 'TvShowEpisode') and (podcastName eq 'Nightly')"
    );
  });

  it("shows an empty TV hub when contentKind is unknown instead of a generic error", async () => {
    const fixture = await renderWithSearch(vi.fn()
      .mockReturnValue(throwError(() => unknownField("contentKind"))));
    expect(oData.getEntitiesWithFacets).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('There were no results for "Nightly"');
    expect(fixture.nativeElement.textContent).not.toContain("Something went wrong");
  });

  it("filters the news hub by NewsReport and seriesName", async () => {
    await render("news");
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].filter).toBe(
      "(contentKind eq 'NewsReport') and (seriesName eq 'Nightly')"
    );
  });

  it("shows the result count, subject pills, and news report noun", async () => {
    const fixture = await render("news");
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].facets).toEqual(["subjects,count:1000,sort:count"]);
    expect(fixture.nativeElement.textContent).toContain("Nightly has 1 report found by CultPodcasts.com");
    expect(fixture.nativeElement.textContent).toContain("Subjects");
    expect(fixture.nativeElement.textContent).toContain("World");
  });
});
