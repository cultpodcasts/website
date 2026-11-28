import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { filmPageCommands } from '../catalogue-links';
import { CreateFilmDialogComponent } from '../create-film-dialog/create-film-dialog.component';
import { CreateFilmDialogClose } from '../film-create.interface';
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

describe('ToolbarComponent New film from TMDB/IMDb', () => {
  const filmId = '11111111-2222-4333-8444-555555555555';
  let dialogOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function openWith(roles: string[], closed: CreateFilmDialogClose | undefined) {
    TestBed.resetTestingModule();
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(closed) });
    snackOpen = vi.fn().mockReturnValue({ onAction: () => NEVER });
    await TestBed.configureTestingModule({
      imports: [ToolbarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        { provide: AuthServiceWrapper, useValue: { roles: of(roles), avatarUrl: () => 'avatar.png' } },
        { provide: DiscoveryInfoService, useValue: { discoveryInfo: NEVER } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return TestBed.createComponent(ToolbarComponent);
  }

  it('opens the create-film dialog, then the film hub and an attach-trailer offer after a create', async () => {
    const fixture = await openWith(['Curator'], { created: true, filmId, name: 'Synthetic Film' });

    fixture.componentInstance.openCreateFilm();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(dialogOpen.mock.calls[0][0]).toBe(CreateFilmDialogComponent);
    expect(snackOpen).toHaveBeenCalledWith(
      'Film created. To attach a trailer, open the episode, choose Attach as trailer and pick this film.',
      'Ok', { duration: 10000 });
    expect(navigate).toHaveBeenCalledWith(filmPageCommands('Synthetic Film', filmId));
    expect(navigate.mock.calls[0][0][0]).toBe('/film');
  });

  it('opens the existing film when the curator chose it after a 409', async () => {
    const fixture = await openWith(['Curator'],
      { created: false, existing: true, filmId, name: 'Synthetic Film' });

    fixture.componentInstance.openCreateFilm();

    expect(snackOpen).toHaveBeenCalledWith('This film already exists. Opened it.', 'Ok', { duration: 10000 });
    expect(navigate).toHaveBeenCalledWith(filmPageCommands('Synthetic Film', filmId));
  });

  it('warns that a created film is not in search yet and still opens the film hub', async () => {
    const fixture = await openWith(['Curator'], {
      created: true,
      failureIndexing: true,
      filmId,
      name: 'Synthetic Film'
    });

    fixture.componentInstance.openCreateFilm();

    expect(snackOpen).toHaveBeenCalledWith(
      expect.stringContaining('not in search yet'),
      'Ok', { duration: 10000 });
    expect(navigate).toHaveBeenCalledWith(filmPageCommands('Synthetic Film', filmId));
  });

  it('does nothing when a created close omits the film name', async () => {
    const fixture = await openWith(['Curator'], { created: true, filmId });

    fixture.componentInstance.openCreateFilm();

    expect(snackOpen).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does nothing when the dialog is cancelled or dismissed', async () => {
    const cancelled = await openWith(['Curator'], { created: false });
    cancelled.componentInstance.openCreateFilm();
    expect(snackOpen).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    const dismissed = await openWith(['Curator'], undefined);
    dismissed.componentInstance.openCreateFilm();
    expect(snackOpen).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  /** Opens the profile menu, then its Curate submenu, and reports whether the New film item is there. */
  async function curateMenuHasNewFilm(roles: string[]): Promise<boolean> {
    const fixture = await openWith(roles, undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('#avatar') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const curate = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-menu-item'))
      .find(item => item.textContent?.trim().endsWith('Curate'));
    if (!curate) {
      return false;
    }
    curate.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const labels = Array.from(document.querySelectorAll<HTMLElement>('.menu-create-film')).map(i => i.textContent?.trim());
    return labels.some(label => label?.includes('New film from TMDB/IMDb'));
  }

  it('lists New film from TMDB/IMDb under Curate for a curator', async () => {
    expect(await curateMenuHasNewFilm(['Curator'])).toBe(true);
  });

  it('does not offer the Curate menu (so no New film) to a supervised curator', async () => {
    expect(await curateMenuHasNewFilm(['SupervisedCurator'])).toBe(false);
  });
});
