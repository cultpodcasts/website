import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { ApiEpisode } from '../api-episode.interface';
import { ApprovalStatusDto } from '@cultpodcasts/contracts';
import { wireApiEpisode } from '../api-episode.fixture';
import { buildEpisodeForm } from '../episode-form.util';
import { FeatureSwitchService } from '../feature-switch-service';
import { EditEpisodeDialogComponent } from './edit-episode-dialog.component';

const podcastId = '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const episodeId = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921';

function baseEpisode(overrides: Partial<ApiEpisode> = {}): ApiEpisode {
  return wireApiEpisode({
    id: episodeId,
    podcastId,
    title: 'Synthetic Episode Title',
    description: 'Synthetic description',
    posted: true,
    tweeted: true,
    bluesky: true,
    ignored: false,
    removed: true,
    explicit: false,
    release: new Date('2026-01-02T03:04:05Z'),
    duration: '01:00:00',
    subjects: [],
    guests: [],
    ...overrides
  });
}

/** RPP #1484: approving or rejecting a split-off from the episode editor. */
describe('EditEpisodeDialogComponent split-off review', () => {
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

  function load(episode: ApiEpisode) {
    component.originalEpisode = episode;
    component.form.set(component.withSplitOffReview(episode, buildEpisodeForm(episode)));
  }

  it('holds a split-off awaiting approval and disables its Removed box', () => {
    load(baseEpisode({ approvalStatus: ApprovalStatusDto.AwaitingApproval }));

    expect(component.isHeldSplitOff()).toBe(true);
    expect(component.form()!.controls.removed.disabled).toBe(true);
  });

  it('sends Approve, and not removed, when the curator approves a split-off awaiting approval', () => {
    load(baseEpisode({ approvalStatus: ApprovalStatusDto.AwaitingApproval }));

    component.setApprovalDecision('Approve');
    component.onSubmit();

    expect(send).toHaveBeenCalledWith(podcastId, episodeId, { approvalDecision: 'Approve' });
  });

  it('sends Reject when the curator rejects a split-off awaiting approval', () => {
    load(baseEpisode({ approvalStatus: ApprovalStatusDto.AwaitingApproval }));

    component.setApprovalDecision('Reject');
    component.onSubmit();

    expect(send).toHaveBeenCalledWith(podcastId, episodeId, { approvalDecision: 'Reject' });
  });

  it('can approve a rejected split-off', () => {
    load(baseEpisode({ approvalStatus: ApprovalStatusDto.Rejected }));

    component.setApprovalDecision('Approve');
    component.onSubmit();

    expect(send).toHaveBeenCalledWith(podcastId, episodeId, { approvalDecision: 'Approve' });
  });

  it('does not send Reject again for a split-off that is already rejected', () => {
    load(baseEpisode({ approvalStatus: ApprovalStatusDto.Rejected }));

    component.setApprovalDecision('Reject');
    component.onSubmit();

    expect(send).not.toHaveBeenCalled();
  });

  it('clicking the chosen decision again clears it, so Save sends nothing', () => {
    load(baseEpisode({ approvalStatus: ApprovalStatusDto.AwaitingApproval }));

    component.setApprovalDecision('Approve');
    component.setApprovalDecision('Approve');
    component.onSubmit();

    expect(send).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ noChange: true, podcastId });
  });

  it('leaves an approved (no status) episode editable as usual', () => {
    load(baseEpisode({ removed: false }));
    expect(component.isHeldSplitOff()).toBe(false);
    expect(component.form()!.controls.removed.disabled).toBe(false);

    load(baseEpisode({ removed: false }));
    expect(component.isHeldSplitOff()).toBe(false);
    expect(component.approvalStatus()).toBeNull();
    expect(component.form()!.controls.removed.disabled).toBe(false);
  });
});
