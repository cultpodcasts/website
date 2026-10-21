import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AuthServiceWrapper } from "../auth-service-wrapper.class";
import { provideZonelessChangeDetection } from "@angular/core";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { BehaviorSubject, of, Subject, throwError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { ScrollDispatcher } from "@angular/cdk/scrolling";
import { SeriesHubComponent } from "./series-hub.component";
import { ODataService } from "../odata.service";
import { PlayerService } from "../player.service";
import { SearchResult } from "../search-result.interface";
import { InfiniteScrollStrategy } from "../infinite-scroll-strategy";
import { catalogueHubFilter } from "../playable-search-hit";

describe("SeriesHubComponent", () => {
  let oData: { getEntitiesWithFacets: ReturnType<typeof vi.fn> };
  let scrolled: Subject<void>;

  function entity(id: string, hub: "tv" | "news" = "tv"): SearchResult {
    return {
      id,
      podcastName: "Nightly",
      episodeTitle: `Item ${id}`,
      episodeDescription: "Desc",
      release: new Date("2026-01-02T00:00:00Z"),
      duration: "01:00:00",
      contentKind: hub === "tv" ? "TvShowEpisode" : "NewsReport",
    };
  }

  function page(overrides?: {
    entities?: SearchResult[];
    count?: number;
    subjects?: { value: string; count: number }[];
  }) {
    const entities = overrides?.entities ?? [entity("1")];
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
        entities: [entity("1", hub)],
      }))),
    };
    return createHub(hub);
  }

  let fragment: string | null = null;
  let navigate: ReturnType<typeof vi.fn>;
  let routeSnapshot: { fragment: string | null; params: Record<string, string>; queryParams: Record<string, string> };
  let routeFragment: BehaviorSubject<string | null>;

  beforeEach(() => {
    fragment = null;
  });

  async function createHub(hub: "tv" | "news"): Promise<ComponentFixture<SeriesHubComponent>> {
    scrolled = new Subject<void>();
    routeSnapshot = { fragment, params: { slug: "Nightly" }, queryParams: {} };
    routeFragment = new BehaviorSubject<string | null>(fragment);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SeriesHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthServiceWrapper, useValue: { roles: of([]) } },
        { provide: ODataService, useValue: oData },
        {
          provide: PlayerService,
          useValue: { play: () => undefined, episode: () => undefined, mode: () => "dock" },
        },
        { provide: ScrollDispatcher, useValue: { scrolled: () => scrolled.asObservable() } },
        { provide: InfiniteScrollStrategy, useClass: InfiniteScrollStrategy },
        { provide: ActivatedRoute, useValue: { snapshot: routeSnapshot, fragment: routeFragment.asObservable() } },
      ],
    }).compileComponents();
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.inject(Router).navigate = navigate as unknown as Router["navigate"];
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
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].top).toBe(20);
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].skip).toBe(0);
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
    const fixture = await render("news");
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].filter).toBe(
      "(contentKind eq 'NewsReport') and (seriesName eq 'Nightly')"
    );
    expect(fixture.componentInstance.loadingLabel()).toBe("Loading reports");
  });

  it("shows the result count, subject pills, and news report noun", async () => {
    const fixture = await render("news");
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].facets).toEqual(["subjects,count:1000,sort:count"]);
    expect(fixture.nativeElement.textContent).toContain("Nightly has 1 report found by CultPodcasts.com");
    expect(fixture.nativeElement.textContent).toContain("Subjects");
    expect(fixture.nativeElement.textContent).toContain("World");
  });

  it("orders newest first, then reloads oldest first from the hub menu with the subject filter kept", async () => {
    const fixture = await render("news");
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].orderby).toBe("release desc");
    expect(fixture.nativeElement.querySelector("app-series-hub-menu #sort")?.textContent).toContain("Newest first");
    fixture.componentInstance.toggleSubject("World");
    const menu = fixture.debugElement.query((el) => el.name === "app-series-hub-menu");
    menu.componentInstance.sort.set("release asc");
    menu.triggerEventHandler("sortChange", "release asc");
    fixture.detectChanges();
    await fixture.whenStable();
    const last = oData.getEntitiesWithFacets.mock.calls.at(-1)?.[1];
    expect(last.orderby).toBe("release asc");
    expect(last.filter).toContain("subjects/any");
    expect(last.skip).toBe(0);
  });

  it("narrows the hub filter on toggleSubject without refreshing facets", async () => {
    const fixture = await renderWithSearch(vi.fn()
      .mockReturnValueOnce(of(page({ subjects: [{ value: "World", count: 2 }] })))
      .mockReturnValue(of(page({
        subjects: [{ value: "Other", count: 1 }],
      }))));
    fixture.componentInstance.toggleSubject("World");
    fixture.detectChanges();
    await fixture.whenStable();

    const hub = catalogueHubFilter("Nightly", "tv", false);
    expect(oData.getEntitiesWithFacets.mock.calls[1][1].filter).toBe(
      `${hub} and subjects/any(s: search.in(s, 'World', '£'))`
    );
    expect(fixture.nativeElement.textContent).toContain("World");
    expect(fixture.nativeElement.textContent).not.toContain("Other");

    fixture.componentInstance.clearSubjects();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(oData.getEntitiesWithFacets.mock.calls[2][1].filter).toBe(hub);
  });

  it("restores the unfiltered hub filter when the same subject is toggled off", async () => {
    const fixture = await render("tv");
    fixture.componentInstance.toggleSubject("World");
    fixture.componentInstance.toggleSubject("World");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(oData.getEntitiesWithFacets.mock.calls.at(-1)?.[1].filter).toBe(
      catalogueHubFilter("Nightly", "tv", false)
    );
  });

  it("loads a further page when count exceeds the first page", async () => {
    const first = Array.from({ length: 20 }, (_, i) => entity(String(i + 1)));
    const fixture = await renderWithSearch(vi.fn()
      .mockReturnValueOnce(of(page({ entities: first, count: 50 })))
      .mockReturnValue(of(page({ entities: [entity("21")], count: 50 }))));

    expect(oData.getEntitiesWithFacets.mock.calls[0][1].skip).toBe(0);
    expect(oData.getEntitiesWithFacets.mock.calls[0][1].top).toBe(20);

    vi.spyOn(fixture.componentInstance, "isScrolledToBottom").mockReturnValue(true);
    scrolled.next();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(oData.getEntitiesWithFacets.mock.calls[1][1].skip).toBeGreaterThan(0);
    expect(oData.getEntitiesWithFacets.mock.calls[1][1].skip).toBe(20);
    expect(oData.getEntitiesWithFacets.mock.calls[1][1].top).toBe(100);
  });
  describe("subject chips in the URL fragment", () => {
    const subjects = [{ value: "Topic X", count: 2 }, { value: "Topic Y", count: 1 }];

    it("writes subject clicks to the fragment as new history entries", async () => {
      const fixture = await renderWithSearch(vi.fn().mockReturnValue(of(page({ subjects }))));
      expect(navigate).not.toHaveBeenCalled();

      fixture.componentInstance.toggleSubject("Topic X");
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({
        fragment: "subject=Topic X",
        queryParamsHandling: "preserve",
        replaceUrl: false,
        scroll: "manual",
      });

      fixture.componentInstance.toggleSubject("Topic Y");
      expect(navigate.mock.calls.at(-1)?.[1].fragment).toBe("subject=Topic X&subject=Topic Y");
    });

    /** Browser Back/Forward: the router updates the snapshot, then emits the fragment. */
    function travelTo(next: string | null): void {
      routeSnapshot.fragment = next;
      routeFragment.next(next);
    }

    it("restores each selection on Back and Forward without writing history", async () => {
      const fixture = await renderWithSearch(vi.fn().mockReturnValue(of(page({ subjects }))));
      const hub = fixture.componentInstance as unknown as SeriesHubComponent & { subjects: () => string[] };
      hub.toggleSubject("Topic X");
      hub.toggleSubject("Topic Y");
      travelTo("subject=Topic X&subject=Topic Y");
      navigate.mockClear();
      const calls = oData.getEntitiesWithFacets.mock.calls;
      const before = calls.length;
      expect(before).toBe(3);

      travelTo("subject=Topic X");
      expect(hub.subjects()).toEqual(["Topic X"]);
      expect(calls.at(-1)?.[1].filter).toContain("Topic X");
      expect(calls.at(-1)?.[1].filter).not.toContain("Topic Y");

      travelTo(null);
      expect(hub.subjects()).toEqual([]);
      expect(calls.at(-1)?.[1].filter).toBe(catalogueHubFilter("Nightly", "tv", false));

      travelTo("subject=Topic Y");
      expect(hub.subjects()).toEqual(["Topic Y"]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it("ignores a fragment that arrives with a new page", async () => {
      await renderWithSearch(vi.fn().mockReturnValue(of(page({ subjects }))));
      const before = oData.getEntitiesWithFacets.mock.calls.length;

      routeSnapshot.params = { slug: "Other" };
      travelTo("subject=Topic X");

      expect(oData.getEntitiesWithFacets.mock.calls.length).toBe(before);
    });

    it("clears the fragment when a chip is toggled on and off before the router settles", async () => {
      const fixture = await renderWithSearch(vi.fn().mockReturnValue(of(page({ subjects }))));

      fixture.componentInstance.toggleSubject("Topic X");
      fixture.componentInstance.toggleSubject("Topic X");

      expect(navigate.mock.calls.map(call => call[1].fragment)).toEqual(["subject=Topic X", undefined]);
    });

    it("restores subjects from a bookmarked fragment after the unfiltered facets load", async () => {
      fragment = "subject=Topic Y&subject=Missing topic";
      const fixture = await renderWithSearch(vi.fn().mockReturnValue(of(page({ subjects }))));
      await fixture.whenStable();
      fixture.detectChanges();

      const calls = oData.getEntitiesWithFacets.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][1].filter).toBe(catalogueHubFilter("Nightly", "tv", false));
      expect(calls[1][1].filter).toContain("Topic Y");
      expect(calls[1][1].filter).not.toContain("Missing");
      expect(navigate.mock.calls.at(-1)?.[1]).toMatchObject({ fragment: "subject=Topic Y", replaceUrl: true });
      expect(fixture.nativeElement.textContent).toContain("Topic X");
    });

    it("loads once and clears the fragment when no restored subject is offered", async () => {
      fragment = "subject=Missing topic";
      await renderWithSearch(vi.fn().mockReturnValue(of(page({ subjects }))));

      expect(oData.getEntitiesWithFacets).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls.at(-1)?.[1].fragment).toBeUndefined();
    });
  });
});
