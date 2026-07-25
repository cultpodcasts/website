import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideZonelessChangeDetection } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import {
  HeroManageDialogComponent,
  HeroManageDialogData,
} from './hero-manage-dialog.component';
import { HeroCurationService } from '../hero-curation.service';
import { HomepageEpisode } from '../homepage-episode.interface';

function ep(id: string): HomepageEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(),
    duration: '01:00:00',
    spotify: undefined,
    apple: undefined,
    youtube: undefined,
    bbc: undefined,
    internetArchive: undefined,
    subjects: [],
    image: undefined,
  };
}

describe('HeroManageDialogComponent', () => {
  let fixture: ComponentFixture<HeroManageDialogComponent>;
  let component: HeroManageDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let heroCuration: { setHeroCuration: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    heroCuration = {
      setHeroCuration: vi.fn().mockResolvedValue({ episodeIds: ['b', 'a'], railSubjects: [] }),
    };
    const data: HeroManageDialogData = {
      curated: [ep('a'), ep('b')],
      autofilled: [ep('x')],
    };

    await TestBed.configureTestingModule({
      imports: [HeroManageDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: HeroCurationService, useValue: heroCuration },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroManageDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('seeds curated from dialog data', () => {
    expect(component['curated']().map((e) => e.id)).toEqual(['a', 'b']);
    expect(component['autofilled'].map((e) => e.id)).toEqual(['x']);
  });

  it('reorders on drop and removes by id', () => {
    component.drop({ previousIndex: 0, currentIndex: 1 } as CdkDragDrop<HomepageEpisode[]>);
    expect(component['curated']().map((e) => e.id)).toEqual(['b', 'a']);

    component.remove('b');
    expect(component['curated']().map((e) => e.id)).toEqual(['a']);
  });

  it('saves curated ids and closes with the server response', async () => {
    await component.save();
    expect(heroCuration.setHeroCuration).toHaveBeenCalledWith(['a', 'b']);
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: true, episodeIds: ['b', 'a'] });
  });

  it('surfaces an error and keeps the dialog open when save fails', async () => {
    heroCuration.setHeroCuration.mockRejectedValueOnce(new Error('fail'));
    await component.save();
    expect(component['error']()).toBe(true);
    expect(component['saving']()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes without saving', () => {
    component.close();
    expect(dialogRef.close).toHaveBeenCalledWith({ saved: false });
  });
});
