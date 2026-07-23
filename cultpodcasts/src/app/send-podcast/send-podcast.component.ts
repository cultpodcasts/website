import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Share } from '../share.interface';
import { ShareMode } from "../share-mode.enum";
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { environment } from './../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SubmitDialogResponse } from '../submit-dialog-response.interface';
import { SubmitUrlOriginResponse } from "../submit-url-origin-response.interface";
import { parseSubmittablePodcastUrl } from '../podcast-url-matcher';

@Component({
  selector: 'app-send-podcast',
  templateUrl: './send-podcast.component.html',
  styleUrls: ['./send-podcast.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule]
})

export class SendPodcastComponent {
  submitted = false;
  readonly isSending = signal(false);
  readonly urlShareError = signal(false);
  readonly urlTextError = signal(false);
  readonly unknownError = signal(false);
  readonly submitError = signal(false);
  readonly shareUrl = signal<URL | undefined>(undefined);
  private isAuthenticated = false;
  originResponse: SubmitUrlOriginResponse | undefined;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<SendPodcastComponent, SubmitDialogResponse>,
    private auth: AuthServiceWrapper) {
    auth.authService.isAuthenticated$.subscribe(x => this.isAuthenticated = x);
  }

  close() {
    this.dialogRef.close({ submitted: this.submitted, originResponse: this.originResponse, });
  }

  public async submit(data: Share) {
    const url = parseSubmittablePodcastUrl(data.url.toString());

    if (url) {
      this.isSending.set(true);
      const body = { url: url.toString(), podcastId: data.podcastId, podcastName: data.podcastName };
      let headers: HttpHeaders = new HttpHeaders();
      if (this.isAuthenticated || localStorage.getItem("hasLoggedIn")) {
        let token: string | undefined;
        try {
          token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
            authorizationParams: {
              audience: `https://api.cultpodcasts.com/`,
              scope: 'submit'
            }
          }));
        } catch (e) {
          console.error(e);
        }
        if (token) {
          headers = headers.set("Authorization", "Bearer " + token);
        }
      }

      try {
        const resp = await firstValueFrom<HttpResponse<any>>(this.http.post(new URL("/submit", environment.api).toString(), body, { headers: headers, observe: 'response' }));
        if (resp.status == 200) {
          this.submitted = true;
          if (resp.headers.get('X-Origin')) {
            this.originResponse = resp.body;
          }
        } else {
          this.submitError.set(true);
          this.isSending.set(false);
        }
        this.close();
      } catch (error) {
        this.isSending.set(false);
        this.submitError.set(true);
      }
      return;
    }

    if (data.shareMode == ShareMode.Share) {
      this.urlShareError.set(true);
      this.shareUrl.set(data.url);
    } else if (data.shareMode == ShareMode.Text) {
      this.urlTextError.set(true);
      this.shareUrl.set(data.url);
    } else {
      this.unknownError.set(true);
    }
  }
}
