import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { ApiEpisode } from '../api-episode.interface';
import { buildEpisodeForm } from '../episode-form.util';
import { FeatureSwitchService } from '../feature-switch-service';
import { EditEpisodeDialogComponent } from './edit-episode-dialog.component';

const podcastId = '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const episodeId = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921';

function baseEpisode(overrides: Partial<ApiEpisode> = {}): ApiEpisode {
  return {
    id: episodeId,
    podcastId,
    title: 'Synthetic Episode Title',
    description: 'Synthetic description',
    posted: false,
    tweeted: false,
    bluesky: false,
    ignored: false,
    removed: false,
    explicit: false,
    release: new Date('2026-01-02T03:04:05Z'),
    duration: '01:00:00',
    urls: {},
    subjects: [],
    guests: [],
    ...overrides
  };
}

describe('EditEpisodeDialogComponent Bluesky posted', () => {
  let component: EditEpisodeDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dialogRef = { close: vi.fn() };
    component = new EditEpisodeDialogComponent(
      {} as AuthServiceWrapper,
      {} as HttpClient,
      dialogRef as unknown as MatDialogRef<EditEpisodeDialogComponent, any>,
      { podcastIdentifier: 'Synthetic Podcast', episodeId },
      { open: vi.fn() } as unknown as MatDialog,
      {} as FeatureSwitchService,
      {} as ChangeDetectorRef,
      { navigate: vi.fn() } as unknown as Router,
      { open: vi.fn() } as unknown as MatSnackBar);
    component.podcastId = podcastId;
    send = vi.spyOn(component, 'send').mockImplementation(() => undefined);
  });

  it('submits blueskyPosted false when originally posted and Bluesky posted is unchecked', () => {
    const episode = baseEpisode({ bluesky: true });
    component.originalEpisode = episode;
    component.form.set(buildEpisodeForm(episode));
    component.form()!.controls.blueskyPosted.setValue(false);

    component.onSubmit();

    expect(send).toHaveBeenCalledWith(podcastId, episodeId, expect.objectContaining({ blueskyPosted: false }));
  });

  it('submits blueskyPosted true when never posted and Bluesky posted is checked', () => {
    const episode = baseEpisode({ bluesky: false });
    component.originalEpisode = episode;
    const form = buildEpisodeForm(episode);
    component.form.set(form);
    form.controls.blueskyPosted.setValue(true);

    component.onSubmit();

    expect(form.controls.blueskyPosted.disabled).toBe(false);
    expect(send).toHaveBeenCalledWith(podcastId, episodeId, expect.objectContaining({ blueskyPosted: true }));
  });

  it('does not send blueskyPosted when unchanged', () => {
    const episode = baseEpisode({ bluesky: false });
    component.originalEpisode = episode;
    component.form.set(buildEpisodeForm(episode));

    component.onSubmit();

    expect(send).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ noChange: true, podcastId });
  });
});
