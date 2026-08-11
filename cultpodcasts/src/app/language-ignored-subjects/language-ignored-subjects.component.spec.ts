import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { LanguageIgnoredSubjectsComponent } from './language-ignored-subjects.component';
import { LanguageTitleCasingRulesResponse } from '../title-casing-rules/title-casing-rules.interface';

describe('LanguageIgnoredSubjectsComponent', () => {
  let fixture: ComponentFixture<LanguageIgnoredSubjectsComponent>;
  let component: LanguageIgnoredSubjectsComponent;
  let httpMock: HttpTestingController;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let confirmResult: { result: boolean };
  let dialogOpen: ReturnType<typeof vi.fn>;
  let getAccessTokenSilently: ReturnType<typeof vi.fn>;

  const languagesUrl = new URL('/languages', environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const frRulesUrl = new URL('/title-casing-rules/fr', environment.api).toString();
  const deRulesUrl = new URL('/title-casing-rules/de', environment.api).toString();
  const frIgnoredSubjectsUrl = new URL(
    '/title-casing-rules/fr/ignored-subjects',
    environment.api
  ).toString();

  const frRules: LanguageTitleCasingRulesResponse = {
    language: 'fr',
    lowerCaseTerms: [],
    knownTerms: [],
    ignoredSubjects: ['Comedy'],
    isDefault: false,
  };

  const allSubjects = [
    { name: 'Comedy' },
    { name: 'News' },
    { name: 'Sport' },
  ];

  async function expectOneSoon(url: string) {
    for (let i = 0; i < 20; i++) {
      const matches = httpMock.match(url);
      if (matches.length === 1) {
        return matches[0];
      }
      await Promise.resolve();
    }
    return httpMock.expectOne(url);
  }

  async function flushInitialLoad(
    rules: LanguageTitleCasingRulesResponse = frRules,
    languages: Record<string, string> = { en: 'English', fr: 'French', de: 'German' }
  ) {
    let languagesReq;
    let subjectsReq;
    for (let i = 0; i < 20; i++) {
      languagesReq = httpMock.match(languagesUrl)[0] ?? languagesReq;
      subjectsReq = httpMock.match(subjectsUrl)[0] ?? subjectsReq;
      if (languagesReq && subjectsReq) {
        break;
      }
      await Promise.resolve();
    }
    if (!languagesReq || !subjectsReq) {
      languagesReq = languagesReq ?? httpMock.expectOne(languagesUrl);
      subjectsReq = subjectsReq ?? httpMock.expectOne(subjectsUrl);
    }

    expect(languagesReq.request.method).toBe('GET');
    expect(subjectsReq.request.method).toBe('GET');
    expect(languagesReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(subjectsReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    languagesReq.flush(languages);
    subjectsReq.flush(allSubjects);

    const rulesReq = await expectOneSoon(frRulesUrl);
    expect(rulesReq.request.method).toBe('GET');
    expect(rulesReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    rulesReq.flush(rules);
  }

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    confirmResult = { result: true };
    dialogOpen = vi.fn().mockImplementation(() => ({
      afterClosed: () => of(confirmResult),
    }));
    getAccessTokenSilently = vi.fn().mockReturnValue(of('test-token'));

    await TestBed.configureTestingModule({
      imports: [LanguageIgnoredSubjectsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: { getAccessTokenSilently },
          },
        },
      ],
    }).compileComponents();

    TestBed.overrideProvider(MatDialog, { useValue: { open: dialogOpen } });

    fixture = TestBed.createComponent(LanguageIgnoredSubjectsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    const initPromise = component.ngOnInit();
    await flushInitialLoad();
    await initPromise;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads non-English languages, ignored subjects, and subject picker on init', () => {
    expect(getAccessTokenSilently).toHaveBeenCalledWith({
      authorizationParams: {
        audience: 'https://api.cultpodcasts.com/',
        scope: 'admin',
      },
    });
    expect(component.languageOptions().map(o => o.code)).toEqual(['fr', 'de']);
    expect(component.languageOptions().some(o => o.code === 'en')).toBe(false);
    expect(component.selectedLanguage()).toBe('fr');
    expect(component.ignoredSubjects()).toEqual(['Comedy']);
    expect(component.allSubjects()).toEqual(['Comedy', 'News', 'Sport']);
  });

  it('reloads ignored subjects when language changes', async () => {
    const pending = component.onLanguageChange('de');

    const rulesReq = await expectOneSoon(deRulesUrl);
    expect(rulesReq.request.method).toBe('GET');
    rulesReq.flush({
      ...frRules,
      language: 'de',
      ignoredSubjects: ['News'],
    });

    await pending;
    expect(component.selectedLanguage()).toBe('de');
    expect(component.ignoredSubjects()).toEqual(['News']);
  });

  it('adds an ignored subject via POST', async () => {
    component.newSubject.set('News');
    const pending = component.addIgnoredSubject();

    const post = await expectOneSoon(frIgnoredSubjectsUrl);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ term: 'News' });
    expect(post.request.headers.get('Authorization')).toBe('Bearer test-token');
    post.flush({
      ...frRules,
      ignoredSubjects: ['Comedy', 'News'],
    });

    await pending;
    expect(component.ignoredSubjects()).toEqual(['Comedy', 'News']);
    expect(component.newSubject()).toBe('');

    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: true });
  });

  it('removes an ignored subject via DELETE after confirm', async () => {
    const pending = component.deleteIgnoredSubject(0);
    const delUrl = new URL(
      '/title-casing-rules/fr/ignored-subjects/Comedy',
      environment.api
    ).toString();

    const del = await expectOneSoon(delUrl);
    expect(del.request.method).toBe('DELETE');
    expect(del.request.headers.get('Authorization')).toBe('Bearer test-token');
    del.flush({
      ...frRules,
      ignoredSubjects: [],
    });

    await pending;
    expect(component.ignoredSubjects()).toEqual([]);
    expect(dialogOpen).toHaveBeenCalled();
  });

  it('shows empty state when ignored subjects list is empty', async () => {
    const pending = component.onLanguageChange('de');

    const reload = await expectOneSoon(deRulesUrl);
    reload.flush({ ...frRules, language: 'de', ignoredSubjects: [] });

    await pending;
    expect(component.ignoredSubjects()).toEqual([]);
  });

  it('blocks add/delete while mutating', async () => {
    component.newSubject.set('News');
    const pending = component.addIgnoredSubject();
    expect(component.isMutating()).toBe(true);

    await component.addIgnoredSubject();
    await component.deleteIgnoredSubject(0);

    const post = await expectOneSoon(frIgnoredSubjectsUrl);
    post.flush({ ...frRules, ignoredSubjects: ['Comedy', 'News'] });
    await pending;
    expect(component.isMutating()).toBe(false);
  });

  it('rejects unknown subject names without POST', async () => {
    component.newSubject.set('NotARealSubject');
    await component.addIgnoredSubject();

    expect(component.addError()).toContain('Pick a subject');
    expect(httpMock.match(req => req.method === 'POST')).toEqual([]);
  });

  it('surfaces load failure on 401', async () => {
    httpMock.verify();
    getAccessTokenSilently.mockReturnValue(of('test-token'));

    const localFixture = TestBed.createComponent(LanguageIgnoredSubjectsComponent);
    const localComponent = localFixture.componentInstance;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const initPromise = localComponent.ngOnInit();
    let languagesReq;
    let subjectsReq;
    for (let i = 0; i < 20; i++) {
      languagesReq = httpMock.match(languagesUrl)[0] ?? languagesReq;
      subjectsReq = httpMock.match(subjectsUrl)[0] ?? subjectsReq;
      if (languagesReq && subjectsReq) {
        break;
      }
      await Promise.resolve();
    }
    languagesReq!.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    subjectsReq!.flush(allSubjects);

    await initPromise;
    expect(localComponent.isInError()).toBe(true);
    expect(localComponent.errorMessage()).toContain('Failed to load');

    errorSpy.mockRestore();
  });

  it('surfaces mutation failure on 403', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.newSubject.set('News');
    const pending = component.addIgnoredSubject();

    const post = await expectOneSoon(frIgnoredSubjectsUrl);
    post.flush({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await pending;
    expect(component.isInError()).toBe(true);
    expect(component.errorMessage()).toBe('Forbidden');

    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: false });
    errorSpy.mockRestore();
  });

  it('surfaces mutation failure on 400', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.newSubject.set('News');
    const pending = component.addIgnoredSubject();

    const post = await expectOneSoon(frIgnoredSubjectsUrl);
    post.flush({ error: 'Subject already ignored.' }, { status: 400, statusText: 'Bad Request' });

    await pending;
    expect(component.isInError()).toBe(true);
    expect(component.errorMessage()).toBe('Subject already ignored.');
    errorSpy.mockRestore();
  });

  it('surfaces mutation failure on 5xx', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = component.deleteIgnoredSubject(0);

    const delUrl = new URL(
      '/title-casing-rules/fr/ignored-subjects/Comedy',
      environment.api
    ).toString();
    const del = await expectOneSoon(delUrl);
    del.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    await pending;
    expect(component.isInError()).toBe(true);
    expect(component.errorMessage()).toBe('Server error');
    errorSpy.mockRestore();
  });

  it('shows token error when admin scope token is unavailable', async () => {
    httpMock.verify();
    getAccessTokenSilently.mockReturnValue(throwError(() => new Error('login_required')));

    const localFixture = TestBed.createComponent(LanguageIgnoredSubjectsComponent);
    const localComponent = localFixture.componentInstance;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await localComponent.ngOnInit();

    expect(localComponent.isInError()).toBe(true);
    expect(localComponent.errorMessage()).toBe('Could not get admin token.');
    expect(httpMock.match(() => true)).toEqual([]);

    errorSpy.mockRestore();
  });
});
