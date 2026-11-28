import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { PlayerService } from '../player.service';
import { TvShowTrailersComponent } from './tv-show-trailers.component';

const showId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';
const showUrl = (name: string) => new URL(`/tvshow/${encodeURIComponent(name)}`, environment.api).toString();

const trailers = [
  { id: 't1', title: 'Synthetic Teaser', url: 'https://www.youtube.com/watch?v=synthetic01', duration: '0:02:11' },
  { id: 't2', title: 'Synthetic Clip', url: 'https://archive.org/details/synthetic-clip', duration: '0:00:45' }
];

describe('TvShowTrailersComponent', () => {
  let fixture: ComponentFixture<TvShowTrailersComponent>;
  let roles: BehaviorSubject<string[]>;
  let http: HttpTestingController;

  beforeEach(async () => {
    roles = new BehaviorSubject<string[]>(['Curator']);
    await TestBed.configureTestingModule({
      imports: [TvShowTrailersComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
        PlayerService,
        {
          provide: AuthServiceWrapper,
          useFactory: () => ({ roles, authService: { getAccessTokenSilently: () => of('test-token') } })
        }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TvShowTrailersComponent);
    fixture.componentRef.setInput('showName', 'Synthetic Show');
  });

  afterEach(() => http.verify());

  async function settle(): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function flushShow(body: object, name = 'Synthetic Show'): Promise<HTMLElement> {
    await settle();
    http.expectOne(showUrl(name)).flush(body);
    return settle();
  }

  it('a curator sees the show\'s trailers as rail cards, in order, under Trailers and extras', async () => {
    const el = await flushShow({ id: showId, name: 'Synthetic Show', trailers });

    expect(el.querySelector('app-episode-rail .rail__title')?.textContent?.trim()).toBe('Trailers and extras');
    const cards = Array.from(el.querySelectorAll('app-film-trailer-card'));
    expect(cards.map(card => card.querySelector('.episode-poster__episode')?.textContent?.trim()))
      .toEqual(['Synthetic Teaser', 'Synthetic Clip']);
  });

  it('gives a YouTube trailer its thumbnail, duration and Watch button, and a plain Trailer byline with the TV icon', async () => {
    const el = await flushShow({ id: showId, name: 'Synthetic Show', trailers });
    const card = el.querySelector('app-film-trailer-card') as HTMLElement;

    expect(card.querySelector('img')?.getAttribute('src')).toBe('https://i.ytimg.com/vi/synthetic01/hqdefault.jpg');
    expect(card.querySelector('.episode-poster__badge--duration')?.textContent?.trim()).toBe('0:02:11');
    expect(card.querySelector('button.episode-poster__cta')?.textContent?.trim()).toBe('Watch');
    const byline = card.querySelector('.episode-poster__byline');
    expect(byline?.textContent).toContain('Trailer');
    expect(byline?.textContent).toContain('live_tv');
    expect(byline?.textContent).not.toContain('Synthetic Show');
  });

  it('opens a non-streaming trailer on its own page in a new tab', async () => {
    const el = await flushShow({ id: showId, name: 'Synthetic Show', trailers });
    const link = el.querySelectorAll('app-film-trailer-card')[1].querySelector('a[href="https://archive.org/details/synthetic-clip"]');

    expect(link).toBeTruthy();
  });

  it('shows nothing for a show with no trailers, and for a show that cannot be read', async () => {
    let el = await flushShow({ id: showId, name: 'Synthetic Show' });
    expect(el.querySelector('app-episode-rail')).toBeNull();

    fixture.componentRef.setInput('showName', 'Missing Show');
    await settle();
    http.expectOne(showUrl('Missing Show')).flush({ message: 'nope' }, { status: 404, statusText: 'Not Found' });
    el = await settle();
    expect(el.querySelector('app-episode-rail')).toBeNull();
  });

  it('skips a trailer with an unusable URL and keeps the rest', async () => {
    const el = await flushShow({
      id: showId,
      name: 'Synthetic Show',
      trailers: [{ ...trailers[0], url: 'javascript:alert(1)' }, trailers[1]]
    });

    expect(Array.from(el.querySelectorAll('app-film-trailer-card .episode-poster__episode')).map(t => t.textContent?.trim()))
      .toEqual(['Synthetic Clip']);
  });

  it('makes no request and shows nothing for anyone who is not a curator', async () => {
    roles.next(['Submitter']);

    const el = await settle();

    http.expectNone(showUrl('Synthetic Show'));
    expect(el.querySelector('app-episode-rail')).toBeNull();
  });

  it('clears the rail when the curator signs out, and reads the show when they sign in', async () => {
    let el = await flushShow({ id: showId, name: 'Synthetic Show', trailers });
    expect(el.querySelectorAll('app-film-trailer-card').length).toBe(2);

    roles.next([]);
    el = await settle();
    expect(el.querySelector('app-episode-rail')).toBeNull();

    roles.next(['Curator']);
    await settle();
    http.expectOne(showUrl('Synthetic Show')).flush({ id: showId, name: 'Synthetic Show', trailers: [trailers[0]] });
    el = await settle();
    expect(el.querySelectorAll('app-film-trailer-card').length).toBe(1);
  });

  it('reads the new show when the name changes, ignoring the answer for the old one', async () => {
    await settle();
    const first = http.expectOne(showUrl('Synthetic Show'));
    fixture.componentRef.setInput('showName', 'Other Show');
    await settle();
    expect(first.cancelled).toBe(true);
    http.expectOne(showUrl('Other Show')).flush({ id: showId, name: 'Other Show', trailers: [trailers[1]] });
    const el = await settle();

    expect(Array.from(el.querySelectorAll('app-film-trailer-card .episode-poster__episode')).map(t => t.textContent?.trim()))
      .toEqual(['Synthetic Clip']);
  });

  it('reload() reads the show again so an edit shows at once', async () => {
    let el = await flushShow({ id: showId, name: 'Synthetic Show', trailers });
    expect(el.querySelectorAll('app-film-trailer-card').length).toBe(2);

    fixture.componentInstance.reload();
    await settle();
    http.expectOne(showUrl('Synthetic Show')).flush({ id: showId, name: 'Synthetic Show', trailers: [trailers[1]] });
    el = await settle();

    expect(Array.from(el.querySelectorAll('app-film-trailer-card .episode-poster__episode')).map(t => t.textContent?.trim()))
      .toEqual(['Synthetic Clip']);
  });
});
