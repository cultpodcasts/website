import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { PodcastIndexComponent } from '../podcast-index/podcast-index.component';
import { SearchIndexerState } from '../search-indexer-state.interface';
import { EditCatalogueParentDialogComponent } from '../edit-catalogue-parent-dialog/edit-catalogue-parent-dialog.component';
import { RenameCatalogueParentDialogComponent } from '../rename-catalogue-parent-dialog/rename-catalogue-parent-dialog.component';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { SeriesHubMenuComponent } from './series-hub-menu.component';

const parentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const videoUrl = 'https://www.youtube.com/watch?v=abc123def45';

type MenuInternals = {
  showIndex(): boolean;
  showEdit(): boolean;
  showSubmit(): boolean;
  showRename(): boolean;
  visible(): boolean;
  triggerLabel(): string;
  setSort(sort: string): void;
  submitUrl(): void;
  edit(): void;
  rename(): void;
  index(): void;
};

describe('SeriesHubMenuComponent', () => {
  let roles: BehaviorSubject<string[]>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let sendSubmit: ReturnType<typeof vi.fn>;
  let submitDialogResult: unknown;
  let indexDialogResult: unknown;
  let indexCatalogueParent: ReturnType<typeof vi.fn>;
  let snackAction: Subject<void>;
  const savedFlags = { ...environment.catalogueParentCuration };

  beforeEach(async () => {
    roles = new BehaviorSubject<string[]>(['Curator', 'Admin']);
    sendSubmit = vi.fn(async () => undefined);
    submitDialogResult = { url: videoUrl };
    indexDialogResult = undefined;
    indexCatalogueParent = vi.fn();
    snackAction = new Subject<void>();
    dialogOpen = vi.fn((component: unknown) => {
      if (component === SubmitPodcastComponent) {
        return { afterClosed: () => of(submitDialogResult) };
      }
      if (component === PodcastIndexComponent) {
        return { afterClosed: () => of(indexDialogResult), componentInstance: { indexCatalogueParent } };
      }
      if (component === SendPodcastComponent) {
        return { afterClosed: () => of({ submitted: true }), componentInstance: { submit: sendSubmit } };
      }
      return { afterClosed: () => of(undefined) };
    });
    snackOpen = vi.fn(() => ({ onAction: () => snackAction.asObservable() }));
    await TestBed.configureTestingModule({
      imports: [SeriesHubMenuComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen, openFromComponent: vi.fn() } },
        {
          provide: AuthServiceWrapper,
          useFactory: () => ({ roles, authService: { getAccessTokenSilently: () => of('test-token') } })
        }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    Object.assign(environment.catalogueParentCuration, savedFlags);
    TestBed.inject(HttpTestingController).verify();
  });

  function create(hub: 'news' | 'tv' = 'news', name = 'Desk'): { fixture: ComponentFixture<SeriesHubMenuComponent>; menu: MenuInternals } {
    const fixture = TestBed.createComponent(SeriesHubMenuComponent);
    fixture.componentRef.setInput('hub', hub);
    fixture.componentRef.setInput('seriesName', name);
    fixture.detectChanges();
    return { fixture, menu: fixture.componentInstance as unknown as MenuInternals };
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  it('shows Index, Edit and Submit to curators and Rename to admins', () => {
    const { menu } = create();
    expect([menu.showIndex(), menu.showEdit(), menu.showSubmit(), menu.showRename()]).toEqual([true, true, true, true]);
    roles.next(['Curator']);
    expect([menu.showIndex(), menu.showEdit(), menu.showSubmit(), menu.showRename()]).toEqual([true, true, true, false]);
    roles.next(['Admin']);
    expect(menu.showIndex()).toBe(false);
    roles.next([]);
    expect([menu.showIndex(), menu.showEdit(), menu.showSubmit(), menu.showRename()]).toEqual([false, false, false, false]);
  });

  it('hides each curation item when its environment flag is off', () => {
    Object.assign(environment.catalogueParentCuration, { submit: false, edit: false, rename: false, index: false });
    const { menu } = create();
    expect([menu.showIndex(), menu.showEdit(), menu.showSubmit(), menu.showRename()]).toEqual([false, false, false, false]);
  });

  it('on the empty hub a curator still gets the Curate trigger for Index alone', () => {
    Object.assign(environment.catalogueParentCuration, { submit: false, edit: false, rename: false, index: true });
    const { fixture, menu } = create();
    fixture.componentRef.setInput('sortable', false);
    roles.next(['Curator']);
    expect(menu.visible()).toBe(true);
    expect(menu.triggerLabel()).toBe('Curate');
  });

  it('Index opens the index dialog for the hub and name, and Review goes to the hub page and reloads it', () => {
    const { fixture, menu } = create('news', 'Desk One');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let reloads = 0;
    fixture.componentInstance.indexed.subscribe(() => reloads++);
    indexDialogResult = { updated: true, itemIds: ['a', 'b'], searchIndexerState: SearchIndexerState.Executed };
    menu.index();
    expect(dialogOpen.mock.calls[0][0]).toBe(PodcastIndexComponent);
    expect(indexCatalogueParent).toHaveBeenCalledWith('news', 'Desk One');
    expect(snackOpen).toHaveBeenCalledWith('News Outlet indexed. 2 items updated.', 'Review', { duration: 10000 });
    snackAction.next();
    expect(navigate).toHaveBeenCalledWith(['/news', 'Desk One']);
    expect(reloads).toBe(1);
  });

  it('Index says when nothing new was found, and when the search push failed', () => {
    const { menu } = create('tv', 'Nightly');
    indexDialogResult = { updated: true, itemIds: [], searchIndexerState: SearchIndexerState.NoDocuments };
    menu.index();
    expect(snackOpen.mock.calls[0].slice(0, 2)).toEqual(['TV Show indexed. Nothing new', 'Ok']);
    indexDialogResult = { updated: true, itemIds: ['a'], searchIndexerState: SearchIndexerState.Failure };
    menu.index();
    expect(snackOpen.mock.calls[1][0]).toBe('TV Show indexed. 1 item updated. Index update failed.');
  });

  it('Index reports not indexable, not found and an ambiguous name', () => {
    const { menu } = create('tv', 'Nightly');
    for (const result of [
      { notIndexable: true, reason: 'NotAutoIndexed' },
      { notIndexable: true, reason: 'SourcePodcastStillExists' },
      { notFound: true },
      { ambiguous: true },
      { updated: false }
    ]) {
      indexDialogResult = result;
      menu.index();
    }
    expect(snackOpen.mock.calls.map((call) => call[0])).toEqual([
      'TV Show not indexable',
      'TV Show not indexable (its podcast still exists)',
      'TV Show not found',
      'More than one tv show is called "Nightly". Nothing was indexed.'
    ]);
  });

  it('keeps the sort trigger for everyone, and on the empty hub shows "Curate" only when an item is available', () => {
    const { fixture, menu } = create();
    roles.next([]);
    expect(menu.visible()).toBe(true);
    expect(menu.triggerLabel()).toBe('Newest first');
    fixture.componentRef.setInput('sortable', false);
    expect(menu.visible()).toBe(false);
    roles.next(['Curator']);
    expect(menu.visible()).toBe(true);
    expect(menu.triggerLabel()).toBe('Curate');
  });

  it('emits sort changes', () => {
    const { fixture, menu } = create();
    const seen: string[] = [];
    fixture.componentInstance.sort.subscribe((value) => seen.push(value));
    menu.setSort('release asc');
    expect(seen).toEqual(['release asc']);
    expect(menu.triggerLabel()).toBe('Oldest first');
  });

  it('submits the URL to the news outlet by id, with the outlet shown in the dialog', async () => {
    const { menu } = create('news', 'Desk One');
    menu.submitUrl();
    expect(dialogOpen.mock.calls[0][0]).toBe(SubmitPodcastComponent);
    expect(dialogOpen.mock.calls[0][1].data).toEqual({ attachToPage: true, target: { label: 'News Outlet', name: 'Desk One' } });
    await settle();
    TestBed.inject(HttpTestingController)
      .expectOne(new URL('/newsorganisation/Desk%20One', environment.api).toString())
      .flush({ id: parentId, name: 'Desk One' });
    await settle();
    expect(sendSubmit).toHaveBeenCalledTimes(1);
    const share = sendSubmit.mock.calls[0][0];
    expect(share.url.href).toBe(videoUrl);
    expect(share.podcastId).toBeUndefined();
    expect(share.podcastName).toBeUndefined();
    expect(share.parent).toEqual({ parentKind: CatalogueParentKind.NewsOrganisation, parentId, parentName: 'Desk One' });
  });

  it('sends nothing when the TV show cannot be resolved', async () => {
    const { menu } = create('tv', 'Nightly');
    menu.submitUrl();
    await settle();
    TestBed.inject(HttpTestingController)
      .expectOne(new URL('/tvshow/Nightly', environment.api).toString())
      .flush([parentId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'], { status: 409, statusText: 'Conflict' });
    await settle();
    expect(sendSubmit).not.toHaveBeenCalled();
    expect(snackOpen.mock.calls[0][0]).toContain('More than one tv show');
  });

  it('does nothing when the submit dialog is cancelled', async () => {
    submitDialogResult = undefined;
    const { menu } = create();
    menu.submitUrl();
    await settle();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(sendSubmit).not.toHaveBeenCalled();
  });

  it('opens the edit and rename dialogs with the hub and name', () => {
    const { menu } = create('tv', 'Nightly');
    menu.edit();
    menu.rename();
    expect(dialogOpen.mock.calls[0][0]).toBe(EditCatalogueParentDialogComponent);
    expect(dialogOpen.mock.calls[0][1].data).toEqual({ hub: 'tv', name: 'Nightly' });
    expect(dialogOpen.mock.calls[1][0]).toBe(RenameCatalogueParentDialogComponent);
    expect(dialogOpen.mock.calls[1][1].data).toEqual({ hub: 'tv', name: 'Nightly' });
  });
});
