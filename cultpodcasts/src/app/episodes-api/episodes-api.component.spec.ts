import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SiteService } from '../site.service';
import { HeroCurationService } from '../hero-curation.service';
import { EpisodesApiComponent } from './episodes-api.component';

describe('EpisodesApiComponent (embedded)', () => {
  let http: HttpTestingController;
  let site: { setQuery: ReturnType<typeof vi.fn>; setPodcast: ReturnType<typeof vi.fn>; setSubject: ReturnType<typeof vi.fn> };
  let routeParams: BehaviorSubject<Record<string, string>>;

  beforeEach(async () => {
    site = { setQuery: vi.fn(), setPodcast: vi.fn(), setSubject: vi.fn() };
    routeParams = new BehaviorSubject<Record<string, string>>({ episodeIds: JSON.stringify(['route-id']) });
    await TestBed.configureTestingModule({
      imports: [EpisodesApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivatedRoute, useValue: { params: routeParams } },
        { provide: AuthServiceWrapper, useValue: { roles: of(['Curator']), authService: { getAccessTokenSilently: () => of('tok') } } },
        { provide: SiteService, useValue: site },
        { provide: HeroCurationService, useValue: { getHeroCuration: () => Promise.resolve({ episodeIds: [], updatedAt: null }), toggleEpisode: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const flushTicks = () => new Promise(r => setTimeout(r, 0));

  it('loads the episode ids passed as input instead of the route param, without resetting site state', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['e1', 'e2']);
    fixture.componentRef.setInput('embedded', true);
    fixture.componentRef.setInput('heading', 'Ingested episodes');
    fixture.detectChanges();
    await flushTicks();
    const reqs = http.match(r => r.url.includes('/episode/'));
    expect(reqs.map(r => new URL(r.request.url).pathname)).toEqual(['/episode/e1', '/episode/e2']);
    expect(reqs[0].request.headers.get('Authorization')).toBe('Bearer tok');
    expect(site.setQuery).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('h2')?.textContent).toBe('Ingested episodes');
    expect((fixture.nativeElement as HTMLElement).querySelector('.curator-toolbar--embedded')).not.toBeNull();
  });

  it('reloads when the input ids change', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['e1']);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    http.match(r => r.url.includes('/episode/'));
    fixture.componentRef.setInput('episodeIds', ['e1', 'e3']);
    fixture.detectChanges();
    await flushTicks();
    expect(http.match(r => r.url.includes('/episode/')).map(r => new URL(r.request.url).pathname)).toEqual(['/episode/e1', '/episode/e3']);
  });

  it('still uses the route param on /episodes', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.detectChanges();
    await flushTicks();
    expect(http.match(r => r.url.includes('/episode/')).map(r => new URL(r.request.url).pathname)).toEqual(['/episode/route-id']);
    expect(site.setQuery).toHaveBeenCalledWith(null);
  });
});
