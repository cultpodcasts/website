import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component } from '@angular/core';
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

@Component({
  selector: 'app-send-podcast',
  templateUrl: './send-podcast.component.html',
  styleUrls: ['./send-podcast.component.sass'],
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule]
})

export class SendPodcastComponent {
  submitted: boolean = false;
  isSending: boolean = false;
  urlShareError: boolean = false;
  urlTextError: boolean = false;
  unknownError: boolean = false;
  submitError: boolean = false;
  shareUrl: URL | undefined;
  spotify: RegExp = /^(?:https?:)?\/\/open\.spotify\.com\/episode\/[A-Za-z\d]+/;
  youtube: RegExp = /^(?:https?:\/\/)?(?:(?:www\.)?youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)[A-Za-z\d\-\_]+/;
  apple: RegExp = /^(?:https?:)?\/\/podcasts\.apple\.com\/(\w+\/)?podcast\/[a-z\-0-9]+\/id\d+\?i=\d+/;
  bbc: RegExp = /^(?:https?:)?\/\/www\.bbc\.co\.uk\/((iplayer\/episode\/[\w]+\/[A-Za-z\d\-_]+)|(sounds\/play\/[\w]+))/;
  internetArchve: RegExp = /^(?:https?:)?\/\/archive\.org\/details\/[A-Za-z\d\-_]+/;
  isAuthenticated: boolean = false;
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
    let matchedUrl: string | undefined;
    let url: URL | undefined;

    if (
      this.spotify.test(data.url.toString()) ||
      this.youtube.test(data.url.toString()) ||
      this.apple.test(data.url.toString()) ||
      this.bbc.test(data.url.toString()) ||
      this.internetArchve.test(data.url.toString())
    ) {
      this.isSending = true;

      if (this.spotify.test(data.url.toString())) {
        let match = data.url.toString().match(this.spotify);
        if (match != null) {
          matchedUrl = match[0];
        }
      } else if (this.youtube.test(data.url.toString())) {
        let match = data.url.toString().match(this.youtube);
        if (match != null) {
          matchedUrl = match[0];
        }
      } else if (this.apple.test(data.url.toString())) {
        let match = data.url.toString().match(this.apple);
        if (match != null) {
          matchedUrl = match[0];
        }
      } else if (this.bbc.test(data.url.toString())) {
        let match = data.url.toString().match(this.bbc);
        if (match != null) {
          matchedUrl = match[0];
        }
      } else if (this.internetArchve.test(data.url.toString())) {
        matchedUrl = data.url.toString();
      }

      if (matchedUrl) {
        try {
          url = new URL(matchedUrl);
        } catch {
          if (!/^\w+\:\/\//.test(matchedUrl)) {
            try {
              url = new URL("https://" + matchedUrl);
            } catch { }
          }
        }

        if (url) {
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
              this.submitError = true;
              this.isSending = false;
            }
            this.close();
          } catch (error) {
            this.isSending = false;
            this.submitError = true;
          }

        }
      }
    }
    if (!matchedUrl || !url) {
      if (data.shareMode == ShareMode.Share) {
        this.urlShareError = true;
        this.shareUrl = data.url;
      } else if (data.shareMode == ShareMode.Text) {
        this.urlTextError = true;
        this.shareUrl = data.url;
      } else {
        this.unknownError = true;
      }
    }
  }
}
