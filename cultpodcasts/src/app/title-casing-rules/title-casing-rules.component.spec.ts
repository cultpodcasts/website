import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { TitleCasingRulesComponent } from './title-casing-rules.component';
import { LanguageTitleCasingRulesResponse } from './title-casing-rules.interface';

describe('TitleCasingRulesComponent', () => {
  let fixture: ComponentFixture<TitleCasingRulesComponent>;
  let component: TitleCasingRulesComponent;
  let httpMock: HttpTestingController;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let confirmResult: { result: boolean };
  let dialogOpen: ReturnType<typeof vi.fn>;

  const languagesUrl = new URL('/languages', environment.api).toString();
  const enRulesUrl = new URL('/title-casing-rules/en', environment.api).toString();
  const lowerCaseTermsUrl = new URL(
    '/title-casing-rules/en/lower-case-terms',
    environment.api
  ).toString();
  const universalRulesUrl = new URL(
    `/title-casing-rules/${encodeURIComponent('*')}`,
    environment.api
  ).toString();

  const enRules: LanguageTitleCasingRulesResponse = {
    language: 'en',
    lowerCaseTerms: ['of', 'the'],
    knownTerms: [
      { literal: 'BBC', pattern: '\\bBBC\\b', options: 'IgnoreCase' },
    ],
    isDefault: false,
  };

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

  async function flushInitialLoad(rules: LanguageTitleCasingRulesResponse = enRules) {
    const languagesReq = await expectOneSoon(languagesUrl);
    expect(languagesReq.request.method).toBe('GET');
    languagesReq.flush({ en: 'English', fr: 'French' });

    const rulesReq = await expectOneSoon(enRulesUrl);
    expect(rulesReq.request.method).toBe('GET');
    rulesReq.flush(rules);
  }

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    snackBar = { open: vi.fn() };
    confirmResult = { result: true };
    dialogOpen = vi.fn().mockImplementation(() => ({
      afterClosed: () => of(confirmResult),
    }));

    await TestBed.configureTestingModule({
      imports: [TitleCasingRulesComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MatSnackBar, useValue: snackBar },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: {
              getAccessTokenSilently: () => of('test-token'),
            },
          },
        },
      ],
    }).compileComponents();

    TestBed.overrideProvider(MatSnackBar, { useValue: snackBar });
    TestBed.overrideProvider(MatDialog, { useValue: { open: dialogOpen } });

    fixture = TestBed.createComponent(TitleCasingRulesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    // Drive init explicitly so we can flush HTTP after auth resolves.
    const initPromise = component.ngOnInit();
    await flushInitialLoad();
    await initPromise;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('adds a lower-case term via POST and closes with saved when mutated', async () => {
    component.newLowerCaseTerm = 'and';
    const pending = component.addLowerCaseTerm();

    const post = await expectOneSoon(lowerCaseTermsUrl);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ term: 'and' });
    post.flush({
      ...enRules,
      lowerCaseTerms: ['of', 'the', 'and'],
    });

    await pending;
    expect(component.currentRules()?.lowerCaseTerms).toContain('and');

    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: true });
  });

  it('deletes a lower-case term via DELETE', async () => {
    const pending = component.deleteLowerCaseTerm(0);
    const delUrl = new URL(
      '/title-casing-rules/en/lower-case-terms/of',
      environment.api
    ).toString();

    const del = await expectOneSoon(delUrl);
    expect(del.request.method).toBe('DELETE');
    del.flush({
      ...enRules,
      lowerCaseTerms: ['the'],
    });

    await pending;
    expect(component.currentRules()?.lowerCaseTerms).toEqual(['the']);
  });

  it('does not set didMutate when promote aborts because term is already in Universal', async () => {
    const pending = component.promoteKnownTerm(0);

    const universalGet = await expectOneSoon(universalRulesUrl);
    expect(universalGet.request.method).toBe('GET');
    universalGet.flush({
      language: '*',
      lowerCaseTerms: [],
      knownTerms: [{ literal: 'BBC', pattern: '\\bBBC\\b', options: 'IgnoreCase' }],
      isDefault: false,
    });

    await pending;

    expect(snackBar.open).toHaveBeenCalledWith(
      'That known term is already in Universal.',
      'Dismiss',
      expect.objectContaining({ duration: 4000 })
    );
    expect(httpMock.match(req => req.method === 'POST' || req.method === 'DELETE')).toEqual([]);

    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: false });
  });

  it('POSTs the new lower-case term before DELETEing the old one, and skips DELETE when POST fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.startEditLowerCaseTerm(0);
    component.editingLowerCaseValue = 'from';

    const pending = component.saveEditLowerCaseTerm();

    const post = await expectOneSoon(lowerCaseTermsUrl);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ term: 'from' });
    post.flush({ error: 'conflict' }, { status: 409, statusText: 'Conflict' });

    const reload = await expectOneSoon(enRulesUrl);
    reload.flush(enRules);

    await pending;

    expect(httpMock.match(req => req.method === 'DELETE')).toEqual([]);
    expect(component.currentRules()?.lowerCaseTerms).toEqual(['of', 'the']);

    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: false });
    errorSpy.mockRestore();
  });

  it('on lower-case rename, DELETEs only after a successful POST', async () => {
    component.startEditLowerCaseTerm(0);
    component.editingLowerCaseValue = 'from';

    const pending = component.saveEditLowerCaseTerm();

    const post = await expectOneSoon(lowerCaseTermsUrl);
    expect(post.request.method).toBe('POST');
    post.flush({
      ...enRules,
      lowerCaseTerms: ['of', 'the', 'from'],
    });

    const delUrl = new URL(
      '/title-casing-rules/en/lower-case-terms/of',
      environment.api
    ).toString();
    const del = await expectOneSoon(delUrl);
    expect(del.request.method).toBe('DELETE');
    del.flush({
      ...enRules,
      lowerCaseTerms: ['the', 'from'],
    });

    await pending;
    expect(component.currentRules()?.lowerCaseTerms).toEqual(['the', 'from']);
  });
});
