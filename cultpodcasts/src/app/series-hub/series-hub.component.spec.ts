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
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { authInterceptor } from "../auth.interceptor";
import { environment } from "../../environments/environment";

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

  async function createHub(hub: "tv" | "news", roles: string[] = []): Promise<ComponentFixture<SeriesHubComponent>> {
    scrolled = new Subject<void>();
    routeSnapshot = { fragment, params: { slug: "Nightly" }, queryParams: {} };
    routeFragment = new BehaviorSubject<string | null>(fragment);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SeriesHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthServiceWrapper,
          useValue: { roles: of(roles), authService: { getAccessTokenSilently: () => of("test-token") } }
        },
        { provide: ODataService, useValue: oData },
        {
          provide: PlayerService,
          useValue: { play: () => undefined, episode: () => undefined, mode: () => "dock", queuedKeys: () => new Set<string>() },
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

  it("picks the first TV result that has series identity ids and ignores episode-only ids", async () => {
    const episodeOnly = {
      ...entity("1"),
      imdbId: "tt7654321",
      tmdbId: 11,
      tvdbId: 22
    };
    const withSeries = {
      ...entity("2"),
      seriesImdbId: "tt1234567",
      seriesTmdbId: 99,
      seriesTvdbId: 1001,
      imdbId: "tt0000001"
    };
    oData = {
      getEntitiesWithFacets: vi.fn().mockReturnValue(of(page({
        entities: [episodeOnly, withSeries]
      })))
    };
    const fixture = await createHub("tv");
    const ident = fixture.componentInstance as unknown as {
      identityEpisode: () => SearchResult | undefined;
    };
    expect(ident.identityEpisode()?.id).toBe("2");

    oData = {
      getEntitiesWithFacets: vi.fn().mockReturnValue(of(page({
        entities: [episodeOnly]
      })))
    };
    const empty = await createHub("tv");
    const emptyIdent = empty.componentInstance as unknown as {
      identityEpisode: () => SearchResult | undefined;
    };
    expect(emptyIdent.identityEpisode()).toBeUndefined();
  });
  describe("TV show Trailers and extras rail (RPP #1412)", () => {
    const showUrl = new URL("/tvshow/Nightly", environment.api).toString();
    const showId = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d";
    const teaser = { id: "t1", title: "Synthetic Teaser", url: "https://www.youtube.com/watch?v=synthetic01", duration: "0:02:11" };
    const clip = { id: "t2", title: "Synthetic Clip", url: "https://archive.org/details/synthetic-clip", duration: "0:00:45" };

    async function settle(fixture: ComponentFixture<SeriesHubComponent>): Promise<HTMLElement> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    async function renderTv(roles: string[], hits: SearchResult[] = [entity("1")]) {
      oData = {
        getEntitiesWithFacets: vi.fn().mockReturnValue(of(page({ entities: hits, count: hits.length }))),
      };
      const fixture = await createHub("tv", roles);
      await settle(fixture);
      return { fixture, http: TestBed.inject(HttpTestingController) };
    }

    function trailerTitles(el: HTMLElement): (string | undefined)[] {
      return Array.from(el.querySelectorAll("app-trailer-card .episode-poster__episode")).map(t => t.textContent?.trim());
    }

    function menu(fixture: ComponentFixture<SeriesHubComponent>) {
      return fixture.debugElement.query((el) => el.name === "app-series-hub-menu");
    }

    it("shows the rail to a curator on a TV hub, below the heading and toolbar and above the episode grid", async () => {
      const { fixture, http } = await renderTv(["Curator"]);
      http.expectOne(showUrl).flush({ id: showId, name: "Nightly", trailers: [teaser, clip] });
      const el = await settle(fixture);

      expect(trailerTitles(el)).toEqual(["Synthetic Teaser", "Synthetic Clip"]);
      const toolbar = el.querySelector(".browse-toolbar")!;
      const rail = el.querySelector("app-tv-show-trailers")!;
      const grid = el.querySelector(".browse-grid")!;
      expect(toolbar.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(rail.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("makes no show request and renders no rail for anyone who is not a curator", async () => {
      const { fixture, http } = await renderTv([]);
      const el = await settle(fixture);

      http.expectNone(showUrl);
      expect(el.querySelector("app-episode-rail")).toBeNull();
    });

    it("never renders the rail, or reads a TV show, on a news hub", async () => {
      oData = { getEntitiesWithFacets: vi.fn().mockReturnValue(of(page({ entities: [entity("1", "news")] }))) };
      const fixture = await createHub("news", ["Curator"]);
      const el = await settle(fixture);

      expect(el.querySelector("app-tv-show-trailers")).toBeNull();
      TestBed.inject(HttpTestingController).expectNone(showUrl);
    });

    it("reloads the rail when the hub menu reports the show was edited", async () => {
      const { fixture, http } = await renderTv(["Curator"]);
      http.expectOne(showUrl).flush({ id: showId, name: "Nightly", trailers: [teaser, clip] });
      let el = await settle(fixture);
      expect(trailerTitles(el)).toEqual(["Synthetic Teaser", "Synthetic Clip"]);

      menu(fixture).triggerEventHandler("edited");
      await settle(fixture);
      http.expectOne(showUrl).flush({ id: showId, name: "Nightly", trailers: [clip] });
      el = await settle(fixture);

      expect(trailerTitles(el)).toEqual(["Synthetic Clip"]);
    });

    it("lists the trailers of a show that has no episodes, after the empty-state message, and reloads them after an edit", async () => {
      const { fixture, http } = await renderTv(["Curator"], []);
      http.expectOne(showUrl).flush({ id: showId, name: "Nightly", trailers: [teaser] });
      let el = await settle(fixture);

      expect(el.textContent).toContain('There were no results for "Nightly"');
      expect(trailerTitles(el)).toEqual(["Synthetic Teaser"]);
      const message = el.querySelector(".browse-empty")!;
      const rail = el.querySelector("app-tv-show-trailers")!;
      expect(message.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(message.contains(rail)).toBe(false);

      menu(fixture).triggerEventHandler("edited");
      await settle(fixture);
      http.expectOne(showUrl).flush({ id: showId, name: "Nightly", trailers: [teaser, clip] });
      el = await settle(fixture);

      expect(trailerTitles(el)).toEqual(["Synthetic Teaser", "Synthetic Clip"]);
    });
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
