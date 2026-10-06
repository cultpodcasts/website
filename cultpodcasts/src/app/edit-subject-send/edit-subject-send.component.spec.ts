import { HttpResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { SubjectResponse } from '../subject-response.interface';
import { EditSubjectSendComponent } from './edit-subject-send.component';

describe('EditSubjectSendComponent', () => {
  let fixture: ComponentFixture<EditSubjectSendComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let putSubject: ReturnType<typeof vi.fn>;
  let getSubject: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    putSubject = vi.fn();
    getSubject = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditSubjectSendComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { create: true } },
        {
          provide: CurationSubmitService,
          useValue: { putSubject, getSubject, postSubject: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditSubjectSendComponent);
    fixture.detectChanges();
  });

  function subjectDto(id: string | null, name = 'Alpha Beta'): SubjectResponse {
    return {
      id,
      name,
      aliases: null,
      associatedSubjects: null,
      enrichmentHashTags: null,
      hashTag: null,
      redditFlairTemplateId: null,
      redditFlareText: null,
      subjectType: null,
      knownTerms: null,
    };
  }

  function submitCreate(commandBody: SubjectResponse | null, loaded: SubjectResponse | null) {
    putSubject.mockReturnValue(of(new HttpResponse({ status: 202, body: commandBody })));
    getSubject.mockReturnValue(loaded == null ? throwError(() => ({ status: 500 })) : of(loaded));
    fixture.componentInstance.submit('', { name: 'Alpha Beta' }, true);
  }

  it('loads the created subject with GET after 202 and ignores the command body', () => {
    const loaded = subjectDto('subject-from-get');
    submitCreate(subjectDto('subject-from-command'), loaded);

    expect(putSubject).toHaveBeenCalledWith({ name: 'Alpha Beta' });
    expect(getSubject).toHaveBeenCalledWith('Alpha Beta');
    expect(dialogRef.close).toHaveBeenCalledWith({ updated: true, subject: loaded });
    expect(fixture.componentInstance.sendError()).toBe(false);
  });

  it('keeps the send dialog open when GET returns no id', () => {
    submitCreate(null, subjectDto(null));

    expect(getSubject).toHaveBeenCalledWith('Alpha Beta');
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });

  it('keeps the send dialog open when GET fails', () => {
    submitCreate(subjectDto('subject-from-command'), null);

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });

  it('keeps the send dialog open when the GET id is empty', () => {
    submitCreate(null, subjectDto(''));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });
});
