import { provideZonelessChangeDetection, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MAT_TABS_CONFIG } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { AddEpisodeDialogComponent } from './add-episode-dialog/add-episode-dialog.component';
import { AddEpisodeSendComponent } from './add-episode-send/add-episode-send.component';
import { ApiEpisode } from './api-episode.interface';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { EditEpisodeDialogComponent } from './edit-episode-dialog/edit-episode-dialog.component';
import { EditEpisodeSendComponent } from './edit-episode-send/edit-episode-send.component';
import { FeatureSwitchService } from './feature-switch-service';
import { SelectReorderDirective, SelectReorderListDirective } from './select-reorder';

const podcastId = '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const episodeId = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921';

function episode(): ApiEpisode {
  return {
    id: episodeId,
    podcastId,
    title: 'Synthetic Episode',
    description: 'Synthetic description',
    posted: false,
    tweeted: false,
    bluesky: false,
    ignored: false,
    removed: false,
    explicit: false,
    release: new Date('2026-07-01T12:00:00.000Z'),
    duration: '01:00:00',
    urls: { spotify: new URL('https://open.spotify.com/episode/x') },
    images: {},
    subjects: ['Arts', 'Politics', 'Sport'],
    guests: ['Ann Example', 'Bob Sample']
  } as unknown as ApiEpisode;
}

/** GET responses for the dialogs' load, by path. */
function respond(url: string): unknown {
  const path = new URL(url).pathname;
  if (path.startsWith('/episode/')) return episode();
  if (path === '/subjects') return [{ name: 'Arts' }, { name: 'Politics' }, { name: 'Sport' }, { name: 'Science' }];
  if (path === '/people') return [{ id: 'p-ann', name: 'Ann Example' }, { id: 'p-bob', name: 'Bob Sample' }, { id: 'p-cy', name: 'Cy Other' }];
  if (path === '/languages') return { en: 'English', fr: 'French' };
  return { id: podcastId, name: 'Synthetic Podcast', defaultSubject: null };
}

interface DialogCase {
  name: string;
  component: Type<EditEpisodeDialogComponent | AddEpisodeDialogComponent>;
  data: unknown;
  sendComponent: Type<unknown>;
}

const cases: DialogCase[] = [
  {
    name: 'Edit Episode',
    component: EditEpisodeDialogComponent,
    data: { podcastIdentifier: 'Synthetic Podcast', episodeId },
    sendComponent: EditEpisodeSendComponent
  },
  {
    name: 'Add Episode',
    component: AddEpisodeDialogComponent,
    data: { podcastId, episodeId, isNewPodcast: false },
    sendComponent: AddEpisodeSendComponent
  }
];

/**
 * The real dialog templates: the reorder list on Subjects and Guests is wired to the dialog's regroup, and a
 * reorder alone is what Submit sends (getEpisodeChanges compares order).
 */
describe.each(cases)('$name dialog: reorder selected subjects and guests', ({ component, data, sendComponent }) => {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  let fixture: ComponentFixture<EditEpisodeDialogComponent | AddEpisodeDialogComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let submit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({
        matches: false,
        media: q,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
      })
    });
    submit = vi.fn();
    dialogOpen = vi.fn(() => ({ componentInstance: { submit }, afterClosed: () => NEVER }));
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('token') } } },
        { provide: HttpClient, useValue: { get: (url: string) => of(respond(url)) } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: FeatureSwitchService, useValue: { IsEnabled: () => false } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: LiveAnnouncer, useValue: { announce: vi.fn(() => Promise.resolve()) } },
        { provide: MAT_TABS_CONFIG, useValue: { animationDuration: '0ms' } }
      ]
    })
      .overrideProvider(MatDialog, { useValue: { open: dialogOpen } })
      .overrideProvider(MatSnackBar, { useValue: { open: vi.fn() } })
      .compileComponents();
    fixture = TestBed.createComponent(component);
    for (let i = 0; i < 20 && (fixture.componentInstance.isLoading() || !fixture.componentInstance.form()); i++) {
      await settle();
    }
    await settle();
    expect(fixture.componentInstance.form()).toBeTruthy();
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function showTab(label: string): Promise<void> {
    const tab = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>)
      .find(el => el.textContent?.trim() === label);
    expect(tab).toBeTruthy();
    tab!.click();
    await settle();
    await settle();
  }

  /**
   * Open the select bound to `control` and drop its selected option `from` onto `to`, as the CDK would. The
   * panel is left open: closing it regroups by itself, so the regroup must come from `(reordered)`.
   */
  async function dropOn(controlName: 'subjects' | 'guests', from: number, to: number): Promise<MatSelect> {
    const form = fixture.componentInstance.form()!;
    const select = fixture.debugElement.queryAll(By.directive(MatSelect))
      .map(de => de.componentInstance as MatSelect)
      .find(s => s.ngControl?.control === form.controls[controlName]);
    expect(select).toBeTruthy();
    select!.open();
    await settle();
    const list = fixture.debugElement.queryAll(By.directive(SelectReorderListDirective))
      .find(de => de.injector.get(SelectReorderDirective).select === select)
      ?.injector.get(CdkDropList);
    expect(list).toBeTruthy();
    list!.dropped.emit({ previousIndex: from, currentIndex: to, container: list, previousContainer: list } as unknown as CdkDragDrop<unknown>);
    await settle();
    expect(select!.panelOpen).toBe(true);
    return select!;
  }

  async function close(select: MatSelect): Promise<void> {
    select.close();
    await settle();
  }

  it('a drop on Subjects and on Guests reorders the form value and the regrouped options; Submit sends the new order', async () => {
    const dialog = fixture.componentInstance;

    await showTab('Meta');
    const subjects = await dropOn('subjects', 2, 0);
    expect(dialog.form()!.controls.subjects.value).toEqual(['Sport', 'Arts', 'Politics']);
    expect(dialog.selectedSubjects()).toEqual(['Sport', 'Arts', 'Politics']);
    expect(subjects.options.map(o => o.value).slice(0, 3)).toEqual(['Sport', 'Arts', 'Politics']);
    await close(subjects);

    await showTab('Guests');
    const guests = await dropOn('guests', 0, 1);
    expect(dialog.form()!.controls.guests.value).toEqual(['Bob Sample', 'Ann Example']);
    expect(dialog.selectedGuests().map(p => p.name)).toEqual(['Bob Sample', 'Ann Example']);
    expect(guests.options.map(o => o.value).slice(0, 2)).toEqual(['Bob Sample', 'Ann Example']);
    await close(guests);

    dialog.onSubmit();
    expect(dialogOpen).toHaveBeenCalledWith(sendComponent, expect.anything());
    expect(submit).toHaveBeenCalledWith(podcastId, episodeId, {
      subjects: ['Sport', 'Arts', 'Politics'],
      guests: ['Bob Sample', 'Ann Example']
    });
  });
});
