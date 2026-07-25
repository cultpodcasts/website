import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideZonelessChangeDetection } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { provideRouter } from '@angular/router';
import {
  RailsManageDialogComponent,
  RailsManageDialogData,
} from './rails-manage-dialog.component';
import { HeroCurationService } from '../hero-curation.service';

describe('RailsManageDialogComponent', () => {
  let fixture: ComponentFixture<RailsManageDialogComponent>;
  let component: RailsManageDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let heroCuration: { setRailSubjects: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    heroCuration = {
      setRailSubjects: vi.fn().mockResolvedValue({
        episodeIds: [],
        railSubjects: ['Scientology', 'NXIVM'],
      }),
    };
    const data: RailsManageDialogData = {
      pinned: ['Scientology'],
      eligible: ['Scientology', 'NXIVM', 'Flat Earth'],
      episodeCounts: { Scientology: 5, NXIVM: 4, 'Flat Earth': 3 },
    };

    await TestBed.configureTestingModule({
      imports: [RailsManageDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: HeroCurationService, useValue: heroCuration },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RailsManageDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('excludes pinned subjects from available', () => {
    expect(component['available']()).toEqual(['NXIVM', 'Flat Earth']);
  });

  it('pins, removes, and reorders', () => {
    component.pin('NXIVM');
    expect(component['pinned']()).toEqual(['Scientology', 'NXIVM']);
    expect(component['available']()).toEqual(['Flat Earth']);

    component.drop({ previousIndex: 0, currentIndex: 1 } as CdkDragDrop<string[]>);
    expect(component['pinned']()).toEqual(['NXIVM', 'Scientology']);

    component.remove('NXIVM');
    expect(component['pinned']()).toEqual(['Scientology']);
  });

  it('saves pinned subjects and closes with the server response', async () => {
    component.pin('NXIVM');
    await component.save();
    expect(heroCuration.setRailSubjects).toHaveBeenCalledWith(['Scientology', 'NXIVM']);
    expect(dialogRef.close).toHaveBeenCalledWith({
      saved: true,
      railSubjects: ['Scientology', 'NXIVM'],
    });
  });

  it('surfaces an error when save fails', async () => {
    heroCuration.setRailSubjects.mockRejectedValueOnce(new Error('fail'));
    await component.save();
    expect(component['error']()).toBe(true);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
