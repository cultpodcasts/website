import { HttpResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { SubjectResponse } from '../subject-response.interface';
import { EditSubjectSendComponent } from './edit-subject-send.component';

describe('EditSubjectSendComponent', () => {
  let fixture: ComponentFixture<EditSubjectSendComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let putSubject: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    putSubject = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditSubjectSendComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { create: true } },
        {
          provide: CurationSubmitService,
          useValue: { putSubject, postSubject: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditSubjectSendComponent);
    fixture.detectChanges();
  });

  function subjectDto(id: string | null): SubjectResponse {
    return {
      id,
      name: 'Alpha Beta',
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

  function submitCreate(body: SubjectResponse | null) {
    putSubject.mockReturnValue(of(new HttpResponse({ status: 202, body })));
    fixture.componentInstance.submit('', { name: 'Alpha Beta' }, true);
  }

  it('closes with the created subject when the 202 body has an id', () => {
    const subject = subjectDto('subject-1');
    submitCreate(subject);

    expect(putSubject).toHaveBeenCalledWith({ name: 'Alpha Beta' });
    expect(dialogRef.close).toHaveBeenCalledWith({ updated: true, subject });
    expect(fixture.componentInstance.sendError()).toBe(false);
  });

  it('keeps the send dialog open when the 202 body has no id', () => {
    submitCreate(subjectDto(null));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });

  it('keeps the send dialog open when the 202 body is null', () => {
    submitCreate(null);

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });

  it('keeps the send dialog open when the 202 id is empty', () => {
    submitCreate(subjectDto(''));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.sendError()).toBe(true);
    expect(fixture.componentInstance.isSending()).toBe(false);
  });
});
