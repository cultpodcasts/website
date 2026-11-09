import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { environment } from '../../environments/environment';
import { ShareMode } from '../share-mode.enum';
import { SendPodcastComponent } from './send-podcast.component';
import { SubmitSeriesResolveService } from '../submit-series-resolve.service';
import { GENERIC_SUBMIT_URL_ERROR } from '../submit-url-rejection';

const bbcMessage =
  "BBC News pages can't be submitted. Submit the BBC iPlayer episode, or the video from the BBC News YouTube channel.";

describe('SendPodcastComponent BBC News rejection', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SendPodcastComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: { isAuthenticated$: of(false), getAccessTokenSilently: () => of('token') },
            roles: of([])
          }
        },
        { provide: SubmitSeriesResolveService, useValue: {} }
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const share = {
    url: new URL('https://www.bbc.co.uk/news/uk-example-article'),
    podcastId: undefined,
    podcastName: undefined,
    shareMode: ShareMode.Text
  };

  const bbcComShare = {
    url: new URL('https://www.bbc.com/news/articles/example-article'),
    podcastId: undefined,
    podcastName: undefined,
    shareMode: ShareMode.Text
  };

  it('shows the server rejection message for a 400 rejected submit of a real BBC News URL', async () => {
    const fixture = TestBed.createComponent(SendPodcastComponent);
    const component = fixture.componentInstance;
    const done = component.submit(share);
    const req = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    req.flush(
      { contentKind: 'NewsReport', rejected: true, message: bbcMessage },
      { status: 400, statusText: 'Bad Request' }
    );
    await done;
    expect(component.submitError()).toBe(true);
    expect(component.submitErrorMessage()).toBe(bbcMessage);
    expect(component.submitted).toBe(false);
  });

  it('shows the server rejection message for a bbc.com/news URL', async () => {
    const fixture = TestBed.createComponent(SendPodcastComponent);
    const component = fixture.componentInstance;
    const done = component.submit(bbcComShare);
    const req = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    req.flush(
      { contentKind: 'NewsReport', rejected: true, message: bbcMessage },
      { status: 400, statusText: 'Bad Request' }
    );
    await done;
    expect(component.submitError()).toBe(true);
    expect(component.submitErrorMessage()).toBe(bbcMessage);
  });

    it('keeps the generic submit error when a 400 has no rejection message', async () => {
    const fixture = TestBed.createComponent(SendPodcastComponent);
    const component = fixture.componentInstance;
    const done = component.submit(share);
    const req = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    // Netflix-style 400 without rejected/message
    req.flush({ error: 'bad request' }, { status: 400, statusText: 'Bad Request' });
    await done;
    expect(component.submitError()).toBe(true);
    expect(component.submitErrorMessage()).toBe(GENERIC_SUBMIT_URL_ERROR);
  });
});
