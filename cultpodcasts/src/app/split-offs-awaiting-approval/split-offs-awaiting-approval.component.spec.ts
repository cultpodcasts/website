import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SiteService } from '../site.service';
import { SplitOffsAwaitingApprovalComponent } from './split-offs-awaiting-approval.component';

describe('SplitOffsAwaitingApprovalComponent', () => {
  let http: HttpTestingController;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let getAccessTokenSilently: ReturnType<typeof vi.fn>;

  const podcastId = '77777777-7777-4777-8777-777777777777';
  const episodeId = '88888888-8888-4888-8888-888888888888';

  const awaitingApproval = (r: { url: string }) => new URL(r.url).pathname === '/episodes/awaiting-approval';

  const splitOff = (overrides: Record<string, unknown> = {}) => ({
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
    removed: false,
    explicit: false,
    duration: '00:10:00',
    subjects: [],
    approvalStatus: 'AwaitingApproval',
    ...overrides,
  });

  beforeEach(async () => {
    dialog = { open: vi.fn() };
    snackBar = { open: vi.fn() };
    getAccessTokenSilently = vi.fn(() => of('tok'));
    await TestBed.configureTestingModule({
      imports: [SplitOffsAwaitingApprovalComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently } } },
        { provide: SiteService, useValue: { setQuery: vi.fn(), setPodcast: vi.fn(), setSubject: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const flushTicks = () => new Promise(r => setTimeout(r, 0));

  async function create() {
    const fixture = TestBed.createComponent(SplitOffsAwaitingApprovalComponent);
    fixture.detectChanges();
    await flushTicks();
    return fixture;
  }

  async function load(body: unknown[]) {
    const fixture = await create();
    const req = http.expectOne(awaitingApproval);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush(body);
    await flushTicks();
    fixture.detectChanges();
    return fixture;
  }

  it('lists awaiting-approval split-offs and opens the editor to approve or reject', async () => {
    // Arrange
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const fixture = await load([splitOff()]);
    const el = fixture.nativeElement as HTMLElement;

    // Act
    (el.querySelector('button.approve-or-reject') as HTMLButtonElement).click();

    // Assert
    expect(el.querySelector('h3')?.textContent).toContain('Held split-off');
    expect(el.textContent).toContain('Synthetic Pod');
    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { podcastIdentifier: podcastId, episodeId }
      }));
  });

  it('says when nothing is awaiting approval', async () => {
    // Arrange / Act
    const fixture = await load([]);

    // Assert
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No split-offs are awaiting approval.');
  });

  it('names the episode on its approve or reject button for assistive technology', async () => {
    // Arrange / Act
    const fixture = await load([splitOff({ title: 'Raw title', displayTitle: 'Display title' }), splitOff({ id: 'other', displayTitle: undefined, title: 'Plain title' })]);

    // Assert
    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button.approve-or-reject'))
      .map(b => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Approve or reject Display title', 'Approve or reject Plain title']);
  });

  it('marks a removed episode as Removed and leaves others unmarked', async () => {
    // Arrange / Act
    const fixture = await load([splitOff({ removed: true }), splitOff({ id: 'other', removed: false })]);

    // Assert
    const markers = (fixture.nativeElement as HTMLElement).querySelectorAll('.split-off__removed');
    expect(markers.length).toBe(1);
    expect(markers[0].textContent).toContain('Removed');
  });

  it('shows the error and Reset requests the list again with a fresh token', async () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fixture = await create();
    http.expectOne(awaitingApproval).flush('boom', { status: 500, statusText: 'Server Error' });
    await flushTicks();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#error')?.textContent).toContain('An error occurred.');
    expect(getAccessTokenSilently).toHaveBeenCalledTimes(1);

    // Act
    (Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Reset') as HTMLButtonElement).click();
    await flushTicks();
    http.expectOne(awaitingApproval).flush([splitOff()]);
    await flushTicks();
    fixture.detectChanges();

    // Assert
    expect(getAccessTokenSilently).toHaveBeenCalledTimes(2);
    expect(el.querySelector('#error')).toBeNull();
    expect(el.querySelector('h3')?.textContent).toContain('Held split-off');
    consoleError.mockRestore();
  });

  it('shows the error when the access token cannot be obtained and makes no list request', async () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAccessTokenSilently.mockImplementation(() => { throw new Error('login_required'); });

    // Act
    const fixture = await create();
    fixture.detectChanges();

    // Assert
    http.expectNone(awaitingApproval);
    expect((fixture.nativeElement as HTMLElement).querySelector('#error')).not.toBeNull();
    consoleError.mockRestore();
  });

  it('cancels an in-flight load when another is requested, so a stale response cannot win', async () => {
    // Arrange
    dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, response: {} }) });
    const fixture = await load([splitOff()]);
    const el = fixture.nativeElement as HTMLElement;
    const open = () => (el.querySelector('button.approve-or-reject') as HTMLButtonElement).click();

    // Act: two saves in a row, each triggers a reload
    open();
    await flushTicks();
    open();
    await flushTicks();
    const requests = http.match(awaitingApproval);
    const [first, second] = requests;
    second.flush([]);
    await flushTicks();
    fixture.detectChanges();

    // Assert
    expect(requests.length).toBe(2);
    expect(first.cancelled).toBe(true);
    expect(el.textContent).toContain('No split-offs are awaiting approval.');
  });

  it('reloads the list and says the episode was updated after the editor saves an approval', async () => {
    // Arrange
    dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, response: {} }) });
    const fixture = await load([splitOff()]);

    // Act
    (fixture.nativeElement as HTMLElement).querySelector('button.approve-or-reject')!.dispatchEvent(new Event('click'));
    await flushTicks();
    http.expectOne(awaitingApproval).flush([]);
    await flushTicks();
    fixture.detectChanges();

    // Assert
    expect(snackBar.open).toHaveBeenCalledWith('Episode updated', 'Ok', { duration: 10000 });
    expect(getAccessTokenSilently).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No split-offs are awaiting approval.');
  });

  it('does not reload or show a snackbar when the editor is dismissed without a result', async () => {
    // Arrange
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const fixture = await load([splitOff()]);

    // Act
    (fixture.nativeElement as HTMLElement).querySelector('button.approve-or-reject')!.dispatchEvent(new Event('click'));
    await flushTicks();

    // Assert
    http.expectNone(awaitingApproval);
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(getAccessTokenSilently).toHaveBeenCalledTimes(1);
  });

  it('says there was no change without reloading when the editor closes with no change', async () => {
    // Arrange
    dialog.open.mockReturnValue({ afterClosed: () => of({ noChange: true }) });
    const fixture = await load([splitOff()]);

    // Act
    (fixture.nativeElement as HTMLElement).querySelector('button.approve-or-reject')!.dispatchEvent(new Event('click'));
    await flushTicks();

    // Assert
    http.expectNone(awaitingApproval);
    expect(snackBar.open).toHaveBeenCalledWith('No change', 'Ok', { duration: 3000 });
  });
});
