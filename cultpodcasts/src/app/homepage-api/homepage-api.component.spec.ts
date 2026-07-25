import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of, ReplaySubject } from 'rxjs';
import { HomepageApiComponent } from './homepage-api.component';
import { HomepageService } from '../homepage.service';
import { HeroCurationService } from '../hero-curation.service';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SiteService } from '../site.service';
import { PlayerService } from '../player.service';
import { Homepage } from '../homepage.interface';
import { HomepageEpisode } from '../homepage-episode.interface';
import { SUBJECT_RAIL_MIN_EPISODES } from '../rail-subjects';
import { SearchBarComponent } from '../search-bar/search-bar.component';

@Component({ selector: 'app-search-bar', template: '', standalone: true })
class StubSearchBarComponent {}

function dayOffset(daysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function ep(
  id: string,
  opts: { daysAgo?: number; subjects?: string[] } = {}
): HomepageEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: dayOffset(opts.daysAgo ?? 0),
    duration: '01:00:00',
    subjects: opts.subjects ?? [],
    youtube: new URL(`https://www.youtube.com/watch?v=${id}`),
    spotify: undefined,
    apple: undefined,
    bbc: undefined,
    internetArchive: undefined,
    image: undefined,
  };
}

function homepageWith(episodes: HomepageEpisode[]): Homepage {
  return {
    recentEpisodes: episodes,
    episodeCount: 90000,
    totalDuration: '100.5:00:00',
  };
}

describe('HomepageApiComponent', () => {
  let fixture: ComponentFixture<HomepageApiComponent>;
  let component: HomepageApiComponent;
  let heroCuration: {
    getHeroCuration: ReturnType<typeof vi.fn>;
    setHeroCuration: ReturnType<typeof vi.fn>;
    setRailSubjects: ReturnType<typeof vi.fn>;
    setHomepageCuration: ReturnType<typeof vi.fn>;
  };
  let roles$: ReplaySubject<string[]>;

  beforeEach(async () => {
    roles$ = new ReplaySubject<string[]>(1);
    roles$.next([]);
    heroCuration = {
      getHeroCuration: vi.fn().mockResolvedValue({
        episodeIds: [],
        railSubjects: [],
        updatedAt: null,
      }),
      setHeroCuration: vi.fn().mockImplementation(async (ids: string[]) => ({
        episodeIds: ids,
        railSubjects: [],
        updatedAt: null,
      })),
      setRailSubjects: vi.fn().mockImplementation(async (subjects: string[]) => ({
        episodeIds: [],
        railSubjects: subjects,
        updatedAt: null,
      })),
      setHomepageCuration: vi.fn().mockImplementation(
        async (update: { episodeIds?: string[]; railSubjects?: string[] }) => ({
          episodeIds: update.episodeIds ?? [],
          railSubjects: update.railSubjects ?? [],
          updatedAt: null,
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [HomepageApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: HomepageService,
          useValue: { getHomepageFromApi: vi.fn().mockResolvedValue(homepageWith([])) },
        },
        { provide: HeroCurationService, useValue: heroCuration },
        {
          provide: AuthServiceWrapper,
          useValue: {
            roles: roles$,
            isSignedIn: of(false),
          },
        },
        {
          provide: SiteService,
          useValue: {
            homepageRefresh$: of(),
            searchFocus$: of(),
            currentSiteData: new BehaviorSubject({
              query: null,
              podcast: null,
              subject: null,
            }),
            setQuery: () => undefined,
            setPodcast: () => undefined,
            setSubject: () => undefined,
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            params: new BehaviorSubject({}),
            queryParams: new BehaviorSubject({}),
          },
        },
        {
          provide: PlayerService,
          useValue: {
            episode: () => undefined,
            mode: () => 'dock',
            play: () => undefined,
            queuedKeys: () => new Set<string>(),
          },
        },
      ],
    })
      .overrideComponent(HomepageApiComponent, {
        remove: { imports: [SearchBarComponent] },
        add: { imports: [StubSearchBarComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HomepageApiComponent);
    component = fixture.componentInstance;
    // Drive orchestration APIs without mounting the full homepage chrome.
  });

  function apply(episodes: HomepageEpisode[], curation?: {
    episodeIds?: string[];
    railSubjects?: string[];
  }): void {
    component['curatedEpisodeIds'].set(curation?.episodeIds ?? []);
    component['curatedRailSubjects'].set(curation?.railSubjects ?? []);
    component['applyHomepage'](homepageWith(episodes), { resetScrollProgress: true });
  }

  it('prunes stale curated episode ids for the current week', () => {
    apply([ep('keep'), ep('other')], { episodeIds: ['keep', 'stale-id'] });
    expect(component['curatedEpisodeIds']()).toEqual(['keep']);
    expect(heroCuration.setHomepageCuration).not.toHaveBeenCalled();
    expect(component['pendingKvPrune']).toBe(true);
  });

  it('quietly persists prune when a Curator is signed in', async () => {
    roles$.next(['Curator']);
    apply([ep('keep')], { episodeIds: ['keep', 'gone'] });
    await Promise.resolve();
    expect(component['curatedEpisodeIds']()).toEqual(['keep']);
    expect(heroCuration.setHomepageCuration).toHaveBeenCalled();
    expect(component['pendingKvPrune']).toBe(false);
  });

  it('rolls back promote when persist fails', async () => {
    roles$.next(['Curator']);
    apply([ep('a'), ep('b')], { episodeIds: [] });
    heroCuration.setHeroCuration.mockRejectedValueOnce(new Error('fail'));
    await component.togglePromote(ep('a'));
    expect(component['curatedEpisodeIds']()).toEqual([]);
  });

  it('promotes then demotes an episode for curators', async () => {
    roles$.next(['Curator']);
    apply([ep('a'), ep('b')], { episodeIds: [] });
    await component.togglePromote(ep('a'));
    expect(component['curatedEpisodeIds']()).toEqual(['a']);
    await component.togglePromote(ep('a'));
    expect(component['curatedEpisodeIds']()).toEqual([]);
  });

  it('loads the initial progressive block then grows on loadMoreEpisodes', () => {
    const episodes = Array.from({ length: 120 }, (_, i) => ep(`e${i}`, { daysAgo: i % 6 }));
    apply(episodes);
    const initial = Object.values(component['grouped']()).flat().length;
    expect(initial).toBe(component.renderConfig.initialBlockSize);

    component['loadMoreEpisodes'](component.renderConfig.firstScrollBlockSize);
    const after = Object.values(component['grouped']()).flat().length;
    expect(after).toBe(
      component.renderConfig.initialBlockSize + component.renderConfig.firstScrollBlockSize
    );
  });

  it('background refresh keeps the current visible count', async () => {
    const episodes = Array.from({ length: 100 }, (_, i) => ep(`e${i}`, { daysAgo: i % 5 }));
    apply(episodes);
    component['loadMoreEpisodes'](component.renderConfig.firstScrollBlockSize);
    const visibleBefore = component['visibleCount'];

    const homepageService = TestBed.inject(HomepageService) as unknown as {
      getHomepageFromApi: ReturnType<typeof vi.fn>;
    };
    homepageService.getHomepageFromApi.mockResolvedValueOnce(homepageWith(episodes));
    heroCuration.getHeroCuration.mockResolvedValueOnce({
      episodeIds: [],
      railSubjects: [],
      updatedAt: null,
    });
    await component['refreshHomepageInBackground']();
    expect(component['visibleCount']).toBe(visibleBefore);
  });

  it('interleaves newest day, then pinned subject rails, then remaining days', () => {
    roles$.next(['Curator']);
    const subject = 'TestSubject';
    const newest = Array.from({ length: SUBJECT_RAIL_MIN_EPISODES }, (_, i) =>
      ep(`n${i}`, { daysAgo: 0, subjects: [subject] })
    );
    const older = Array.from({ length: SUBJECT_RAIL_MIN_EPISODES }, (_, i) =>
      ep(`o${i}`, { daysAgo: 2, subjects: [subject] })
    );
    apply([...newest, ...older], { railSubjects: [subject] });

    const rails = component['rails']();
    expect(rails.length).toBeGreaterThanOrEqual(3);
    expect(rails[0].id.startsWith('day:')).toBe(true);
    expect(rails[1].id).toBe(`subject:${subject}`);
    expect(rails.slice(2).every((r) => r.id.startsWith('day:'))).toBe(true);
  });
});
