import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { EditNewsReportDialogComponent } from './edit-news-report-dialog.component';

const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outletId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const api = (path: string) => new URL(path, environment.api).toString();

const synthetic = {
  id: reportId,
  title: 'Bulletin',
  description: 'Synthetic report',
  release: '2026-01-02',
  duration: '0:06:30',
  explicit: false,
  ignored: false,
  removed: false,
  posted: false,
  tweeted: false,
  blueskyPosted: false,
  subjects: ['Politics'],
  searchTerms: null,
  hashTag: null,
  language: null,
  guests: null,
  newsOrganisationId: outletId,
  newsOrganisationName: 'Desk'
};

describe('EditNewsReportDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<EditNewsReportDialogComponent>;

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditNewsReportDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { reportId } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    })
      .overrideProvider(MatDialog, { useValue: { open: vi.fn() } })
      .compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function expectSoon(url: string, method = 'GET') {
    const http = TestBed.inject(HttpTestingController);
    for (let i = 0; i < 30; i++) {
      const hits = http.match((r) => r.urlWithParams === url && r.method === method);
      if (hits.length === 1) {
        return hits[0];
      }
      await Promise.resolve();
    }
    return http.expectOne((r) => r.urlWithParams === url && r.method === method);
  }

  async function settle() {
    for (let i = 0; i < 15; i++) {
      await Promise.resolve();
    }
  }

  async function load(dto: object = synthetic) {
    fixture = TestBed.createComponent(EditNewsReportDialogComponent);
    fixture.detectChanges();
    (await expectSoon(api(`/newsreport/${reportId}`))).flush(dto);
    (await expectSoon(api('/subjects'))).flush([{ name: 'Politics' }, { name: 'Sport' }]);
    (await expectSoon(api('/people'))).flush([{ id: 'p1', name: 'Ann Example' }]);
    (await expectSoon(api('/languages'))).flush({ en: 'English', fr: 'French' });
    (await expectSoon(api(`/newsorganisation/${outletId}`))).flush({ id: outletId, name: 'Desk', defaultSubject: 'Politics' });
    await settle();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('loads the report, the outlet name and the episode-editor lookups into the tabbed form', async () => {
    const dialog = await load();
    expect(dialog.isLoading()).toBe(false);
    expect(dialog.parentName()).toBe('Desk');
    expect(dialog.defaultSubject()).toBe('Politics');
    expect(dialog.languages()).toEqual({ unset: 'English', fr: 'French' });
    expect(dialog.subjectNames()).toEqual(['Politics', 'Sport']);
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Details', 'Flags', 'Meta', 'Guests']);
    expect((fixture.nativeElement as HTMLElement).querySelector('#parent-name')?.textContent).toBe('Desk');
  });

  it('PATCHes only the changed fields and closes with the response and outlet name', async () => {
    const dialog = await load();
    dialog.form()!.patchValue({ title: 'Bulletin two', subjects: ['Politics', 'Sport'], guests: ['Ann Example'], lang: 'fr', removed: true });
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/newsreport/${reportId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      title: 'Bulletin two',
      removed: true,
      subjects: ['Politics', 'Sport'],
      guests: ['Ann Example'],
      language: 'fr'
    });
    patch.flush({ searchIndexerState: 'Executed' }, { status: 202, statusText: 'Accepted' });
    await saving;
    expect(close).toHaveBeenCalledWith({ updated: true, response: { searchIndexerState: 'Executed' }, parentName: 'Desk' });
  });

  it('closes with noChange and sends nothing when the form is untouched', async () => {
    const dialog = await load();
    await dialog.onSubmit();
    expect(close).toHaveBeenCalledWith({ noChange: true, parentName: 'Desk' });
  });

  it('shows the API message on a 400 and keeps the dialog open', async () => {
    const dialog = await load();
    dialog.form()!.patchValue({ duration: 'nonsense' });
    const saving = dialog.onSubmit();
    (await expectSoon(api(`/newsreport/${reportId}`), 'PATCH'))
      .flush({ message: 'Invalid duration' }, { status: 400, statusText: 'Bad Request' });
    await saving;
    expect(dialog.submitError()).toBe('Invalid duration');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows an error when the report cannot be loaded', async () => {
    fixture = TestBed.createComponent(EditNewsReportDialogComponent);
    fixture.detectChanges();
    (await expectSoon(api(`/newsreport/${reportId}`))).flush({ id: reportId }, { status: 404, statusText: 'Not Found' });
    // forkJoin cancels the other lookups on the first error.
    TestBed.inject(HttpTestingController).match(() => true);
    await settle();
    expect(fixture.componentInstance.isInError()).toBe(true);
  });
});
