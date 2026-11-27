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
import { SplitOffsAwaitingApprovalComponent } from './split-offs-awaiting-approval.component';

describe('SplitOffsAwaitingApprovalComponent', () => {
  let http: HttpTestingController;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const podcastId = '77777777-7777-4777-8777-777777777777';
  const episodeId = '88888888-8888-4888-8888-888888888888';

  beforeEach(async () => {
    dialog = { open: vi.fn() };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SplitOffsAwaitingApprovalComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivatedRoute, useValue: { params: new BehaviorSubject<Record<string, string>>({}) } },
        {
          provide: AuthServiceWrapper,
          useValue: { authService: { getAccessTokenSilently: vi.fn(() => of('tok')) } }
        },
        { provide: SiteService, useValue: { setQuery: vi.fn(), setPodcast: vi.fn(), setSubject: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const flushTicks = () => new Promise(r => setTimeout(r, 0));

  async function load(body: unknown[]) {
    const fixture = TestBed.createComponent(SplitOffsAwaitingApprovalComponent);
    fixture.detectChanges();
    await flushTicks();
    const req = http.expectOne(r => new URL(r.url).pathname === '/episodes/awaiting-approval');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush(body);
    await flushTicks();
    fixture.detectChanges();
    return fixture;
  }

  it('lists awaiting-approval split-offs and opens the editor to approve or reject', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const fixture = await load([{
      id: episodeId,
      podcastId,
      podcastName: 'Synthetic Pod',
      title: 'Held split-off',
      displayTitle: 'Held split-off',
      release: '2026-03-01T00:00:00Z',
      description: '',
      posted: false,
      tweeted: false,
      ignored: false,
      removed: true,
      explicit: false,
      duration: '00:10:00',
      subjects: [],
      approvalStatus: 'AwaitingApproval',
    }]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')?.textContent).toContain('Held split-off');
    expect(el.textContent).toContain('Synthetic Pod');

    (el.querySelector('button.approve-or-reject') as HTMLButtonElement).click();
    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { podcastIdentifier: podcastId, episodeId }
      }));
  });

  it('says when nothing is awaiting approval', async () => {
    const fixture = await load([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No split-offs are awaiting approval.');
  });

  it('reloads the list after the editor saves an approval', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, response: {} }) });
    const fixture = await load([{
      id: episodeId,
      podcastId,
      podcastName: 'Synthetic Pod',
      title: 'Held split-off',
      description: '',
      posted: false,
      tweeted: false,
      ignored: false,
      removed: true,
      explicit: false,
      duration: '00:10:00',
      subjects: [],
    }]);
    (fixture.nativeElement as HTMLElement).querySelector('button.approve-or-reject')!.dispatchEvent(new Event('click'));
    await flushTicks();
    const again = http.expectOne(r => new URL(r.url).pathname === '/episodes/awaiting-approval');
    again.flush([]);
    await flushTicks();
    fixture.detectChanges();
    expect(snackBar.open).toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No split-offs are awaiting approval.');
  });
});
