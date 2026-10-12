import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { DiscoveryInfoService } from '../discovery-info.service';
import { environment } from '../../environments/environment';
import { DiscoverySubmitComponent } from './discovery-submit.component';

describe('DiscoverySubmitComponent supervised submits', () => {
  let http: HttpTestingController;
  let close: ReturnType<typeof vi.fn>;
  let getToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    close = vi.fn();
    getToken = vi.fn().mockReturnValue(of('token'));
    TestBed.configureTestingModule({
      imports: [DiscoverySubmitComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: getToken } } },
        { provide: DiscoveryInfoService, useValue: { getDiscoveryInfo: vi.fn() } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function submit(flush: (req: ReturnType<HttpTestingController['expectOne']>) => void) {
    const component = TestBed.createComponent(DiscoverySubmitComponent).componentInstance;
    const done = component.submit({ documentIds: ['d1'], resultIds: ['r1'] });
    const req = await vi.waitFor(() => http.expectOne(new URL('/discovery-curation', environment.api).toString()));
    flush(req);
    await done;
    return component;
  }

  it('requests curate:supervised so a supervised user\'s token is recognised', async () => {
    await submit(req => req.flush({ submissionId: 's1', status: 'Pending' }, { status: 202, statusText: 'Accepted' }));
    expect(getToken.mock.calls[0][0].authorizationParams.scope).toContain('curate:supervised');
  });

  it('closes with the held submission id on 202 instead of an ingest outcome', async () => {
    await submit(req => req.flush({ submissionId: 's1', status: 'Pending' }, { status: 202, statusText: 'Accepted' }));
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ heldSubmissionId: 's1', endpointError: false }));
  });

  it('explains a 409 instead of a generic error', async () => {
    const component = await submit(req => req.flush(
      { message: 'Reports already awaiting review', documentIds: ['d1'] }, { status: 409, statusText: 'Conflict' }));
    expect(component.submitState().endpointError).toBe(true);
    expect(component.submitState().errorMessage).toContain('Reports already awaiting review');
    expect(close).not.toHaveBeenCalled();
  });
});
