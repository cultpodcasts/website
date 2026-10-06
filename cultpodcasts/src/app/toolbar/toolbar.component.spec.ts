import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NEVER, Subject, of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoveryInfoService } from '../discovery-info.service';
import { SubjectResponse } from '../subject-response.interface';
import { EditSubjectDialogComponent } from '../edit-subject-dialog/edit-subject-dialog.component';
import { ToolbarComponent } from './toolbar.component';

describe('ToolbarComponent', () => {
  let fixture: ComponentFixture<ToolbarComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let editAction: Subject<void>;

  const created: SubjectResponse & { id: string } = {
    id: 'subject-1',
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

  beforeEach(async () => {
    editAction = new Subject<void>();
    let opened = 0;
    dialogOpen = vi.fn().mockImplementation(() => {
      opened += 1;
      if (opened === 1) {
        return {
          afterClosed: () => of({ updated: true, subject: created, subjectName: created.name }),
        };
      }
      return { afterClosed: () => NEVER };
    });
    snackOpen = vi.fn().mockReturnValue({
      onAction: () => editAction.asObservable(),
    });

    await TestBed.configureTestingModule({
      imports: [ToolbarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        {
          provide: AuthServiceWrapper,
          useValue: { roles: NEVER, avatarUrl: () => null },
        },
        { provide: DiscoveryInfoService, useValue: { discoveryInfo: NEVER } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarComponent);
  });

  it('opens edit with the created subject when the snackbar Edit action runs', () => {
    fixture.componentInstance.openSubmitSubject();

    expect(snackOpen).toHaveBeenCalledWith('Subject created', 'Edit', { duration: 10000 });
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(dialogOpen.mock.calls[0][0]).toBe(EditSubjectDialogComponent);
    expect(dialogOpen.mock.calls[0][1].data).toEqual({ create: true });

    editAction.next();

    expect(dialogOpen).toHaveBeenCalledTimes(2);
    expect(dialogOpen.mock.calls[1][0]).toBe(EditSubjectDialogComponent);
    expect(dialogOpen.mock.calls[1][1].data).toEqual({
      subjectName: 'Alpha Beta',
      subject: created,
    });
  });
});
