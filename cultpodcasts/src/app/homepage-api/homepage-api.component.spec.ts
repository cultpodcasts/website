import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
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
import { RAIL_DISPLAY_SIZE, SUBJECT_RAIL_MIN_EPISODES } from '../rail-subjects';

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
    services: { youtube: { url: `https://www.youtube.com/watch?v=${id}` } },
    ids: { youtube: id },
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
    toggleEpisode: ReturnType<typeof vi.fn>;
    removeEpisodes: ReturnType<typeof vi.fn>;
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
      toggleEpisode: vi.fn().mockImplementation(
        async (episodeId: string, currentIds: string[]) => {
          const wantPromoted = !currentIds.includes(episodeId);
          const episodeIds = wantPromoted
            ? [episodeId, ...currentIds.filter((id) => id !== episodeId)]
            : currentIds.filter((id) => id !== episodeId);
          return { episodeIds, railSubjects: [], updatedAt: null };
        }
      ),
      removeEpisodes: vi.fn().mockImplementation(async (ids: string[]) => ({
        episodeIds: [],
        railSubjects: [],
        updatedAt: null,
      })),
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
    }).compileComponents();

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
    component['applyHomepage'](homepageWith(episodes));
  }

  it('prunes stale curated episode ids for local display only', () => {
    apply([ep('keep'), ep('other')], { episodeIds: ['keep', 'stale-id'] });
    expect(component['curatedEpisodeIds']()).toEqual(['keep']);
    expect(heroCuration.setHomepageCuration).not.toHaveBeenCalled();
  });

  it('does not persist week prune from the homepage (cron owns Durable Object writes)', async () => {
    roles$.next(['Curator']);
    apply([ep('keep')], { episodeIds: ['keep', 'gone'] });
    await Promise.resolve();
    expect(component['curatedEpisodeIds']()).toEqual(['keep']);
    expect(heroCuration.setHomepageCuration).not.toHaveBeenCalled();
  });

  it('rolls back promote when persist fails', async () => {
    roles$.next(['Curator']);
    apply([ep('a'), ep('b')], { episodeIds: [] });
    heroCuration.toggleEpisode.mockRejectedValueOnce(new Error('fail'));
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

  it('shows every week day rail on first paint without scrolling', () => {
    // Enough episodes that a progressive 40-episode window would omit older days.
    const newest = Array.from({ length: 35 }, (_, i) => ep(`n${i}`, { daysAgo: 0 }));
    const mid = Array.from({ length: 35 }, (_, i) => ep(`m${i}`, { daysAgo: 1 }));
    const older = Array.from({ length: 35 }, (_, i) => ep(`o${i}`, { daysAgo: 3 }));
    apply([...newest, ...mid, ...older]);

    const dayRails = component['rails']().filter((r) => r.id.startsWith('day:'));
    expect(dayRails).toHaveLength(3);
    expect(dayRails.map((r) => r.episodes.length)).toEqual([35, 35, 35]);
  });

  it('background refresh replaces the week without progressive scroll state', async () => {
    const episodes = Array.from({ length: 100 }, (_, i) => ep(`e${i}`, { daysAgo: i % 5 }));
    apply(episodes);
    const dayCountBefore = component['rails']().filter((r) => r.id.startsWith('day:')).length;

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
    const dayCountAfter = component['rails']().filter((r) => r.id.startsWith('day:')).length;
    expect(dayCountAfter).toBe(dayCountBefore);
    expect(dayCountAfter).toBe(5);
  });

  it('interleaves newest day, then pinned subject rails, then remaining days by default', () => {
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

  it('honours a curated mixed day/subject rail order', () => {
    roles$.next(['Curator']);
    const subject = 'OrderedSubject';
    const newest = Array.from({ length: SUBJECT_RAIL_MIN_EPISODES }, (_, i) =>
      ep(`n${i}`, { daysAgo: 0, subjects: [subject] })
    );
    const older = Array.from({ length: SUBJECT_RAIL_MIN_EPISODES }, (_, i) =>
      ep(`o${i}`, { daysAgo: 2, subjects: [subject] })
    );
    apply([...newest, ...older], {
      railSubjects: ['day:1', subject, 'day:0'],
    });

    const rails = component['rails']();
    expect(rails).toHaveLength(3);
    expect(rails[0].id.startsWith('day:')).toBe(true);
    expect(rails[1].id).toBe(`subject:${subject}`);
    expect(rails[2].id.startsWith('day:')).toBe(true);
    expect(rails[0].id).not.toBe(rails[2].id);
    // day:1 (older) before day:0 (newest)
    expect(rails[0].episodes[0].id.startsWith('o')).toBe(true);
    expect(rails[2].episodes[0].id.startsWith('n')).toBe(true);
  });

  it('caps subject rails to RAIL_DISPLAY_SIZE but leaves day rails uncapped', () => {
    roles$.next(['Curator']);
    const subject = 'BusySubject';
    const dayCount = RAIL_DISPLAY_SIZE + 8;
    const episodes = [
      ...Array.from({ length: dayCount }, (_, i) =>
        ep(`day${i}`, { daysAgo: 0, subjects: [subject] })
      ),
      ...Array.from({ length: RAIL_DISPLAY_SIZE + 20 }, (_, i) =>
        ep(`busy${i}`, { daysAgo: 1, subjects: [subject] })
      ),
    ];
    apply(episodes, { railSubjects: [subject] });

    const rails = component['rails']();
    const subjectRail = rails.find((r) => r.id === `subject:${subject}`);
    const dayRail = rails.find((r) => r.id.startsWith('day:'));
    expect(subjectRail?.episodes.length).toBe(RAIL_DISPLAY_SIZE);
    expect(dayRail?.episodes.length).toBe(dayCount);
    expect(
      component['subjectRailCandidates']().find((c) => c.subject === subject)?.episodes.length
    ).toBeGreaterThan(RAIL_DISPLAY_SIZE);
  });
});
