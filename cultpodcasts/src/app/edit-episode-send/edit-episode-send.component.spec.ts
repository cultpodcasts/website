import { MatDialogRef } from '@angular/material/dialog';
import { throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { EditEpisodeSendComponent } from './edit-episode-send.component';

describe('EditEpisodeSendComponent', () => {
  const podcastId = '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
  const episodeId = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921';

  function failWith(error: unknown) {
    const component = new EditEpisodeSendComponent(
      { close: vi.fn() } as unknown as MatDialogRef<EditEpisodeSendComponent>,
      { patchEpisode: vi.fn(() => throwError(() => error)) } as unknown as CurationSubmitService);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.submit(podcastId, episodeId, { approvalDecision: 'Approve' });
    return component;
  }

  it("shows the API's 400 message, e.g. a split-off approval rule (RPP #1484)", () => {
    const component = failWith({ status: 400, error: { message: 'A rejected split-off stays removed.' } });

    expect(component.sendError()).toBe(true);
    expect(component.errorMessage()).toBe('A rejected split-off stays removed.');
  });

  it('keeps only the generic error for other failures', () => {
    const component = failWith({ status: 500, error: { message: 'boom' } });

    expect(component.sendError()).toBe(true);
    expect(component.errorMessage()).toBeNull();
  });
});
