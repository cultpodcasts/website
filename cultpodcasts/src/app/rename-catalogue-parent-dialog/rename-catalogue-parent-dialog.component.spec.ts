import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AUTH_SCOPE, authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SearchIndexerState } from '../search-indexer-state.interface';
import { RenameCatalogueParentDialogComponent } from './rename-catalogue-parent-dialog.component';

type Internals = { newName: string; onSubmit(): Promise<void>; conflict(): boolean; ambiguous(): boolean; isInError(): boolean };

describe('RenameCatalogueParentDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  const renameUrl = new URL('/newsorganisation/name/Old%20Desk', environment.api).toString();

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [RenameCatalogueParentDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { hub: 'news', name: 'Old Desk' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function create(): Internals {
    const fixture = TestBed.createComponent(RenameCatalogueParentDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Internals;
  }

  async function expectRename(): Promise<ReturnType<HttpTestingController['expectOne']>> {
    const http = TestBed.inject(HttpTestingController);
    // match() removes what it returns, so keep the first hit.
    for (let i = 0; i < 20; i++) {
      const hits = http.match(renameUrl);
      if (hits.length === 1) {
        return hits[0];
      }
      await Promise.resolve();
    }
    return http.expectOne(renameUrl);
  }

  it('POSTs { newName } with admin scope and closes with the index state', async () => {
    const dialog = create();
    dialog.newName = '  New Desk ';
    const done = dialog.onSubmit();
    const req = await expectRename();
    expect(req.request.body).toEqual({ newName: 'New Desk' });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('admin');
    req.flush({ indexState: 'Executed' });
    await done;
    expect(close).toHaveBeenCalledWith({ updated: true, newName: 'New Desk', searchIndexerState: SearchIndexerState.Executed });
  });

  it('does not send a blank name or a name with "/"', async () => {
    const dialog = create();
    dialog.newName = 'A/B';
    await dialog.onSubmit();
    dialog.newName = '  ';
    await dialog.onSubmit();
    expect(TestBed.inject(HttpTestingController).match(renameUrl)).toHaveLength(0);
  });

  it('tells a taken new name (empty 409) from an ambiguous current name (409 guid array)', async () => {
    const dialog = create();
    dialog.newName = 'Taken';
    let done = dialog.onSubmit();
    (await expectRename()).flush(null, { status: 409, statusText: 'Conflict' });
    await done;
    expect([dialog.conflict(), dialog.ambiguous(), dialog.isInError()]).toEqual([true, false, true]);

    done = dialog.onSubmit();
    (await expectRename()).flush(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'], { status: 409, statusText: 'Conflict' });
    await done;
    expect([dialog.conflict(), dialog.ambiguous()]).toEqual([false, true]);
    expect(close).not.toHaveBeenCalled();
  });
});
