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
        railSubjects: ['day:0', 'Scientology', 'NXIVM', 'day:1'],
        updatedAt: 't1',
      }),
    };
    const data: RailsManageDialogData = {
      order: ['day:0', 'Scientology', 'day:1'],
      eligible: ['Scientology', 'NXIVM', 'Flat Earth'],
      episodeCounts: { Scientology: 5, NXIVM: 4, 'Flat Earth': 3 },
      dayEpisodeCounts: [10, 8],
      updatedAt: 't0',
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

  it('builds locked day rows labeled n / n−1', () => {
    expect(component['rows']()).toEqual([
      {
        id: 'day:0',
        kind: 'day',
        label: 'n',
        episodeCount: 10,
        locked: true,
      },
      {
        id: 'Scientology',
        kind: 'subject',
        label: 'Scientology',
        episodeCount: 5,
        locked: false,
      },
      {
        id: 'day:1',
        kind: 'day',
        label: 'n−1',
        episodeCount: 8,
        locked: true,
      },
    ]);
  });

  it('pins, reorders, and refuses to remove day slots', () => {
    component.pin('NXIVM');
    expect(component['order']()).toEqual([
      'day:0',
      'Scientology',
      'day:1',
      'NXIVM',
    ]);
    expect(component['available']()).toEqual(['Flat Earth']);

    component.drop({ previousIndex: 0, currentIndex: 2 } as CdkDragDrop<string[]>);
    expect(component['order']()).toEqual([
      'Scientology',
      'day:1',
      'day:0',
      'NXIVM',
    ]);

    component.remove('day:0');
    expect(component['order']()).toContain('day:0');

    component.remove('Scientology');
    expect(component['order']()).toEqual(['day:1', 'day:0', 'NXIVM']);
  });

  it('saves mixed order and closes with the server response', async () => {
    component.pin('NXIVM');
    await component.save();
    expect(heroCuration.setRailSubjects).toHaveBeenCalledWith(
      ['day:0', 'Scientology', 'day:1', 'NXIVM'],
      't0'
    );
    expect(dialogRef.close).toHaveBeenCalledWith({
      saved: true,
      railSubjects: ['day:0', 'Scientology', 'NXIVM', 'day:1'],
      updatedAt: 't1',
    });
  });

  it('surfaces an error when save fails', async () => {
    heroCuration.setRailSubjects.mockRejectedValueOnce(new Error('fail'));
    await component.save();
    expect(component['error']()).toBe(true);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
