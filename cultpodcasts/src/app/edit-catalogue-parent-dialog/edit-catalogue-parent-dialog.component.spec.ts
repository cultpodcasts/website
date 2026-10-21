import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CatalogueParentEditModel } from '../catalogue-parent-edit';
import { EditCatalogueParentDialogComponent } from './edit-catalogue-parent-dialog.component';

const showId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
type Internals = { model(): CatalogueParentEditModel | null; save(): Promise<void>; notFound(): boolean; saveError(): boolean };

describe('EditCatalogueParentDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  const getUrl = new URL('/tvshow/Nightly', environment.api).toString();
  const patchUrl = new URL(`/tvshow/${showId}`, environment.api).toString();

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditCatalogueParentDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { hub: 'tv', name: 'Nightly' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function expectSoon(url: string) {
    const http = TestBed.inject(HttpTestingController);
    // match() removes what it returns, so keep the first hit.
    for (let i = 0; i < 20; i++) {
      const hits = http.match(url);
      if (hits.length === 1) {
        return hits[0];
      }
      await Promise.resolve();
    }
    return http.expectOne(url);
  }

  async function settle() {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  function create(): Internals {
    const fixture = TestBed.createComponent(EditCatalogueParentDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Internals;
  }

  it('loads by name, PATCHes only the changed fields by id, and closes on 202', async () => {
    const dialog = create();
    (await expectSoon(getUrl)).flush({ id: showId, name: 'Nightly', publisher: 'Net', tvdb: 'https://thetvdb.com/series/x' });
    await settle();
    const model = dialog.model()!;
    model.publisher = 'Network Two';
    model.tvdb = '';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ publisher: 'Network Two', tvdb: '' });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(close).toHaveBeenCalledWith({ updated: true });
  });

  it('closes with noChange and sends nothing when unchanged', async () => {
    const dialog = create();
    (await expectSoon(getUrl)).flush({ id: showId, name: 'Nightly' });
    await settle();
    await dialog.save();
    expect(close).toHaveBeenCalledWith({ noChange: true });
  });

  it('shows not found on 404 and offers no form', async () => {
    const dialog = create();
    (await expectSoon(getUrl)).flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(dialog.notFound()).toBe(true);
    expect(dialog.model()).toBeNull();
  });
});
