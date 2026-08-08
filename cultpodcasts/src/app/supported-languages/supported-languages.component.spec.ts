import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SupportedLanguagesComponent } from './supported-languages.component';

describe('SupportedLanguagesComponent', () => {
  let fixture: ComponentFixture<SupportedLanguagesComponent>;
  let component: SupportedLanguagesComponent;
  let httpMock: HttpTestingController;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const languagesUrl = new URL('/supported-languages', environment.api).toString();
  const culturesUrl = new URL('/supported-languages/cultures', environment.api).toString();

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

  async function flushInitialLoad() {
    // Load fires both GETs in parallel — wait until both are outstanding.
    let languagesReq;
    let culturesReq;
    for (let i = 0; i < 20; i++) {
      languagesReq = httpMock.match(languagesUrl)[0] ?? languagesReq;
      culturesReq = httpMock.match(culturesUrl)[0] ?? culturesReq;
      if (languagesReq && culturesReq) {
        break;
      }
      await Promise.resolve();
    }
    if (!languagesReq || !culturesReq) {
      languagesReq = languagesReq ?? httpMock.expectOne(languagesUrl);
      culturesReq = culturesReq ?? httpMock.expectOne(culturesUrl);
    }

    expect(languagesReq.request.method).toBe('GET');
    expect(culturesReq.request.method).toBe('GET');
    languagesReq.flush({
      languages: [
        { code: 'en', name: 'English' },
        { code: 'fr', name: 'French' },
      ],
    });
    culturesReq.flush({
      cultures: [
        { code: 'en', name: 'English' },
        { code: 'fr', name: 'French' },
        { code: 'nl', name: 'Dutch' },
      ],
    });
  }

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SupportedLanguagesComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
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

    fixture = TestBed.createComponent(SupportedLanguagesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    const initPromise = component.ngOnInit();
    await flushInitialLoad();
    await initPromise;
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  it('adds a language via POST and closes with saved when mutated', async () => {
    component.newName = 'Dutch';
    const pending = component.addLanguage();

    const post = await expectOneSoon(languagesUrl);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ name: 'Dutch' });
    post.flush({
      languages: [
        { code: 'en', name: 'English' },
        { code: 'fr', name: 'French' },
        { code: 'nl', name: 'Dutch' },
      ],
    });

    await pending;
    expect(component.languages().some(l => l.code === 'nl')).toBe(true);

    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: true });
  });

  it('rejects unknown names without calling POST', async () => {
    component.newName = 'NotARealLanguage';
    await component.addLanguage();

    expect(component.addError()).toContain('not recognised');
    expect(httpMock.match(req => req.method === 'POST')).toEqual([]);
  });

  it('deletes a language via DELETE after confirm', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    const pending = component.deleteLanguage(0);
    const delUrl = new URL('/supported-languages/en', environment.api).toString();

    const del = await expectOneSoon(delUrl);
    expect(del.request.method).toBe('DELETE');
    del.flush({
      languages: [{ code: 'fr', name: 'French' }],
    });

    await pending;
    expect(component.languages().map(l => l.code)).toEqual(['fr']);
  });

  it('does not DELETE when confirm is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    await component.deleteLanguage(0);

    expect(httpMock.match(req => req.method === 'DELETE')).toEqual([]);
    expect(component.languages().map(l => l.code)).toEqual(['en', 'fr']);
  });
});
