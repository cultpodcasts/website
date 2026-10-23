import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoveryBanService } from '../discovery-ban.service';
import { DiscoveryResult } from '../discovery-result.interface';
import { SiteService } from '../site.service';
import { DiscoverySubmissionsService } from '../discovery-supervision/discovery-submissions.service';
import { DiscoveryApiComponent } from './discovery-api.component';

describe('DiscoveryApiComponent channel ban', () => {
  const visibleId = 'b6f1c2d4-0000-4000-8000-000000000001';
  const hiddenId = 'b6f1c2d4-0000-4000-8000-000000000002';
  const otherId = 'b6f1c2d4-0000-4000-8000-000000000003';
  const channelId = 'UCbannedchannel000000001';

  function card(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
    return {
      id: visibleId,
      urls: { spotify: undefined, apple: undefined, youtube: undefined },
      episodeName: 'Evening briefing',
      showName: 'Northwind Briefing',
      episodeDescription: 'A synthetic episode',
      showDescription: undefined,
      released: new Date('2026-10-01T10:00:00Z'),
      duration: undefined,
      subjects: [],
      youTubeViews: undefined,
      youTubeChannelMembers: undefined,
      containsSyntheticMedia: undefined,
      guests: undefined,
      imageUrl: undefined,
      enrichedTimeFromApple: false,
      enrichedUrlFromSpotify: false,
      matchingPodcasts: null,
      acceptProbability: null,
      autoHidden: false,
      isFocused: undefined,
      youTubeChannelId: channelId,
      ...overrides
    };
  }

  it('hides a same-channel auto-hidden card loaded after the ban and leaves it out of Save', async () => {
    const visible = card();
    const hidden = card({ id: hiddenId, episodeName: 'Morning briefing', autoHidden: true });
    const sameNameOtherChannel = card({
      id: otherId,
      episodeName: 'Harbour edition',
      autoHidden: true,
      youTubeChannelId: 'UCotherchannel0000000001'
    });
    const ban = vi.fn().mockResolvedValue({
      podcast: {
        id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        name: 'Northwind Briefing',
        removed: true,
        youTubeChannelId: channelId
      },
      discovery: { ids: ['doc-1'], hiddenCount: 0, results: [visible] }
    });
    const submit = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [DiscoveryApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: AuthServiceWrapper,
          useValue: { roles: of([]), authService: { getAccessTokenSilently: () => of('token') } }
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: SiteService, useValue: { setQuery: () => undefined, setPodcast: () => undefined, setSubject: () => undefined } },
        { provide: DiscoverySubmissionsService, useValue: {} },
        { provide: DiscoveryBanService, useValue: { ban } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(DiscoveryApiComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    vi.mocked(TestBed.inject(MatDialog).open).mockReturnValue({
      componentInstance: { submit },
      afterClosed: () => of(undefined)
    } as never);

    component.results.set([visible]);
    component.selectedIds.set([visibleId, hiddenId]);
    await component.removePodcast(visible);

    expect(component.hiddenResults().map(item => item.id)).not.toContain(hiddenId);
    expect(component.selectedIds()).not.toContain(visibleId);
    expect(component.selectedIds()).toContain(hiddenId);

    component.loadResults(true);
    await Promise.resolve();
    await Promise.resolve();
    const hiddenUrl = new URL('/discovery-curation', environment.api);
    hiddenUrl.searchParams.set('includeHidden', 'true');
    http.expectOne(hiddenUrl.toString()).flush({
      ids: ['doc-1'],
      hiddenCount: 2,
      results: [visible, hidden, sameNameOtherChannel]
    });

    expect(component.hiddenResults().map(item => item.id)).toEqual([otherId]);
    expect(component.visibleResults().map(item => item.id)).not.toContain(visibleId);
    expect(component.selectedIds()).not.toContain(hiddenId);

    await component.save();
    expect(submit).toHaveBeenCalledWith({
      documentIds: ['doc-1'],
      resultIds: []
    });
    http.verify();
  });
});
