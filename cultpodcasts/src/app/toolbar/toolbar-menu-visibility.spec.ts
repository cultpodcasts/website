import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NEVER, of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoveryInfoService } from '../discovery-info.service';
import { ToolbarComponent } from './toolbar.component';

type Vis = { canCurate: () => boolean; isSupervisor: () => boolean; isSupervisedCurator: () => boolean };

async function visibility(roles: string[]): Promise<{ discovery: boolean; review: boolean; mine: boolean }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ToolbarComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: AuthServiceWrapper, useValue: { roles: of(roles), avatarUrl: () => null } },
      { provide: DiscoveryInfoService, useValue: { discoveryInfo: NEVER } },
    ],
  }).compileComponents();
  const c = TestBed.createComponent(ToolbarComponent).componentInstance as unknown as Vis;
  return { discovery: c.canCurate(), review: c.isSupervisor(), mine: c.isSupervisedCurator() };
}

describe('Toolbar discovery menu visibility', () => {
  it('curator: Discovery only', async () => {
    expect(await visibility(['Curator'])).toEqual({ discovery: true, review: false, mine: false });
  });
  it('supervised curator (curate:supervised): Discovery and My submissions', async () => {
    expect(await visibility(['SupervisedCurator'])).toEqual({ discovery: true, review: false, mine: true });
  });
  it('supervisor without curate: Discovery review only', async () => {
    expect(await visibility(['Supervisor'])).toEqual({ discovery: false, review: true, mine: false });
  });
  it('admin curator: Discovery and a single Discovery review entry', async () => {
    expect(await visibility(['Curator', 'Admin'])).toEqual({ discovery: true, review: true, mine: false });
  });
});
