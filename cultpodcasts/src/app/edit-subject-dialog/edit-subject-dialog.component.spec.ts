import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SubjectResponse } from '../subject-response.interface';
import { EditSubjectDialogComponent, EditSubjectDialogData } from './edit-subject-dialog.component';

const subjectName = 'Alpha Beta';
const inHandSubject: SubjectResponse & { id: string } = {
  id: 'subject-1',
  name: subjectName,
  aliases: null,
  associatedSubjects: null,
  enrichmentHashTags: null,
  hashTag: null,
  redditFlairTemplateId: null,
  redditFlareText: null,
  subjectType: null,
  knownTerms: null,
};

describe('EditSubjectDialogComponent', () => {
  let dialogData: EditSubjectDialogData;
  let token$: Observable<string>;

  const flairsUrl = new URL('/flairs', environment.api).toString();

  async function expectOneSoon(httpMock: HttpTestingController, url: string) {
    for (let i = 0; i < 20; i++) {
      const matches = httpMock.match(url);
      if (matches.length === 1) {
        return matches[0];
      }
      await Promise.resolve();
    }
    return httpMock.expectOne(url);
  }

  async function flushTokenRejection() {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  beforeEach(async () => {
    dialogData = { subject: inHandSubject };
    token$ = of('test-token');
    await TestBed.configureTestingModule({
      imports: [EditSubjectDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useFactory: () => dialogData },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        {
          provide: AuthServiceWrapper,
          useFactory: () => ({
            authService: { getAccessTokenSilently: () => token$ },
          }),
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  function create(): ComponentFixture<EditSubjectDialogComponent> {
    const fixture = TestBed.createComponent(EditSubjectDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function expectBoundName(fixture: ComponentFixture<EditSubjectDialogComponent>) {
    const component = fixture.componentInstance;
    expect(component.form()?.controls.name.value).toBe(subjectName);
    expect(component.isLoading()).toBe(false);
    expect(component.isInError()).toBe(false);
    fixture.detectChanges();
    const nameInput: HTMLInputElement | null = fixture.nativeElement.querySelector('input');
    expect(nameInput?.value).toBe(subjectName);
    expect(fixture.nativeElement.querySelector('#error')).toBeNull();
  }

  it('binds an in-hand subject and does not GET /subject/:name', async () => {
    const fixture = create();
    const httpMock = TestBed.inject(HttpTestingController);
    const flairsReq = await expectOneSoon(httpMock, flairsUrl);
    expect(flairsReq.request.method).toBe('GET');
    expect(flairsReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    flairsReq.flush({});

    httpMock.expectNone((req) => req.url.includes('/subject/'));
    expectBoundName(fixture);
  });

  it('still binds an in-hand subject when /flairs fails', async () => {
    const fixture = create();
    const httpMock = TestBed.inject(HttpTestingController);
    const flairsReq = await expectOneSoon(httpMock, flairsUrl);
    flairsReq.flush('nope', { status: 500, statusText: 'Server Error' });

    httpMock.expectNone((req) => req.url.includes('/subject/'));
    expectBoundName(fixture);
  });

  it('GETs /subject/:name when only the subject name is passed', async () => {
    dialogData = { subjectName };
    const fixture = create();
    const httpMock = TestBed.inject(HttpTestingController);
    const flairsReq = await expectOneSoon(httpMock, flairsUrl);
    flairsReq.flush({});

    const subjectUrl = new URL(`/subject/${encodeURIComponent(subjectName)}`, environment.api).toString();
    const subjectReq = httpMock.expectOne(subjectUrl);
    expect(subjectReq.request.method).toBe('GET');
    expect(subjectReq.request.headers.get('Authorization')).toBe('Bearer test-token');
    subjectReq.flush({ id: 'subject-from-name', name: subjectName });

    expectBoundName(fixture);
  });

  it('binds an in-hand subject when the access token fails', async () => {
    token$ = throwError(() => new Error('login_required'));
    const fixture = create();
    await flushTokenRejection();

    expectBoundName(fixture);
  });

  it('shows an error when the access token fails and only a subject name is passed', async () => {
    dialogData = { subjectName };
    token$ = throwError(() => new Error('login_required'));
    const fixture = create();
    await flushTokenRejection();

    expect(fixture.componentInstance.form()).toBeUndefined();
    expect(fixture.componentInstance.isLoading()).toBe(false);
    expect(fixture.componentInstance.isInError()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#error')?.textContent).toContain('An error occurred');
  });
});
